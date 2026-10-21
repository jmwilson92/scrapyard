"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DatabaseConfigError } from "@/lib/db";
import { emptyFormState, readValues, type FormState } from "@/lib/form-state";
import { hashPassword, verifyPassword } from "@/lib/passwords";
import { safeNextPath } from "@/lib/paths";
import { parseCompanyInput } from "@/lib/business";
import {
  attachUserToCompany,
  findUserByEmail,
  insertCompany,
  insertUser,
  updateCompany,
} from "@/lib/repo";
import { getRequestDb } from "@/lib/server-db";
import { endSession, getCurrentUser, startSession } from "@/lib/session";
import {
  parseLoginInput,
  parseRegisterInput,
} from "@/lib/validation";
import { lookupZip } from "@/lib/zip";

const COMPANY_FIELDS = [
  "companyName",
  "businessType",
  "street",
  "city",
  "state",
  "zip",
  "serviceRadius",
  "ein",
  "website",
  "contactName",
  "contactPhone",
];
const REGISTER_FIELDS = [...COMPANY_FIELDS, "email"];
const LOGIN_FIELDS = ["email"];

export async function registerAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = readValues(formData, REGISTER_FIELDS);
  const credentials = parseRegisterInput(
    {
      shopName: values.companyName ?? "",
      email: values.email ?? "",
      password: stringField(formData, "password"),
      zip: values.zip ?? "",
    },
    (zip) => lookupZip(zip) != null,
  );
  const company = parseCompanyInput(values, (zip) => lookupZip(zip) != null);
  if (!credentials.ok || !company.ok) {
    const errors = {
      ...(credentials.ok ? {} : credentials.errors),
      ...(company.ok ? {} : company.errors),
    };
    delete errors.shopName;
    return { errors, values };
  }

  try {
    const db = await getRequestDb();
    const existing = await findUserByEmail(db, credentials.value.email);
    if (existing) {
      return {
        errors: { email: "An account with that email already exists." },
        values,
      };
    }
    const id = crypto.randomUUID();
    const companyId = crypto.randomUUID();
    await insertCompany(db, { ...company.value, id: companyId });
    await insertUser(db, {
      id,
      email: credentials.value.email,
      passwordHash: await hashPassword(credentials.value.password),
      shopName: company.value.name,
      zip: company.value.zip,
    });
    await attachUserToCompany(db, id, companyId);
    await startSession(id);
  } catch (error) {
    if (error instanceof DatabaseConfigError) {
      return { errors: {}, values, formError: error.message };
    }
    throw error;
  }

  redirect("/account");
}

export async function loginAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = readValues(formData, LOGIN_FIELDS);
  const parsed = parseLoginInput({
    email: values.email ?? "",
    password: stringField(formData, "password"),
  });
  if (!parsed.ok) return { errors: parsed.errors, values };

  try {
    const db = await getRequestDb();
    const user = await findUserByEmail(db, parsed.value.email);
    const matches = user
      ? await verifyPassword(parsed.value.password, user.passwordHash)
      : false;
    if (!user || !matches) {
      return {
        errors: {},
        values,
        formError: "Email or password doesn't match.",
      };
    }
    await startSession(user.id);
  } catch (error) {
    if (error instanceof DatabaseConfigError) {
      return { errors: {}, values, formError: error.message };
    }
    throw error;
  }

  redirect(safeNextPath(stringField(formData, "next"), "/browse"));
}

export async function logoutAction(): Promise<void> {
  await endSession();
  redirect("/");
}

export async function updateCompanyAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = readValues(formData, COMPANY_FIELDS);
  const user = await getCurrentUser();
  if (!user) {
    return { ...emptyFormState, values, formError: "Sign in to update your company." };
  }
  const parsed = parseCompanyInput(values, (zip) => lookupZip(zip) != null);
  if (!parsed.ok) return { errors: parsed.errors, values };

  try {
    const db = await getRequestDb();
    let companyId = user.companyId;
    if (!companyId) {
      companyId = crypto.randomUUID();
      await insertCompany(db, { ...parsed.value, id: companyId, isExample: user.isExample });
      await attachUserToCompany(db, user.id, companyId);
    } else {
      await updateCompany(db, companyId, parsed.value);
    }
  } catch (error) {
    if (error instanceof DatabaseConfigError) {
      return { errors: {}, values, formError: error.message };
    }
    throw error;
  }

  revalidatePath("/account");
  revalidatePath(`/shops/${user.id}`);
  return {
    errors: {},
    values,
    success: "Company profile saved.",
  };
}

function stringField(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}
