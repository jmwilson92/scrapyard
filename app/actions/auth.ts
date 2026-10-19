"use server";

import { redirect } from "next/navigation";
import { DatabaseConfigError } from "@/lib/db";
import { emptyFormState, readValues, type FormState } from "@/lib/form-state";
import { hashPassword, verifyPassword } from "@/lib/passwords";
import { safeNextPath } from "@/lib/paths";
import { findUserByEmail, insertUser, updateUserShop } from "@/lib/repo";
import { getRequestDb } from "@/lib/server-db";
import { endSession, getCurrentUser, startSession } from "@/lib/session";
import {
  parseLoginInput,
  parseRegisterInput,
  parseShopUpdate,
} from "@/lib/validation";
import { lookupZip } from "@/lib/zip";

const REGISTER_FIELDS = ["shopName", "email", "zip"];
const LOGIN_FIELDS = ["email"];
const SHOP_FIELDS = ["shopName", "zip"];

export async function registerAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = readValues(formData, REGISTER_FIELDS);
  const parsed = parseRegisterInput(
    {
      shopName: values.shopName ?? "",
      email: values.email ?? "",
      password: stringField(formData, "password"),
      zip: values.zip ?? "",
    },
    (zip) => lookupZip(zip) != null,
  );
  if (!parsed.ok) return { errors: parsed.errors, values };

  try {
    const db = await getRequestDb();
    const existing = await findUserByEmail(db, parsed.value.email);
    if (existing) {
      return {
        errors: { email: "An account with that email already exists." },
        values,
      };
    }
    const id = crypto.randomUUID();
    await insertUser(db, {
      id,
      email: parsed.value.email,
      passwordHash: await hashPassword(parsed.value.password),
      shopName: parsed.value.shopName,
      zip: parsed.value.zip,
    });
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

export async function updateShopAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = readValues(formData, SHOP_FIELDS);
  const user = await getCurrentUser();
  if (!user) {
    return { ...emptyFormState, values, formError: "Sign in to update the shop." };
  }
  const parsed = parseShopUpdate(
    { shopName: values.shopName ?? "", zip: values.zip ?? "" },
    (zip) => lookupZip(zip) != null,
  );
  if (!parsed.ok) return { errors: parsed.errors, values };

  try {
    const db = await getRequestDb();
    await updateUserShop(db, user.id, parsed.value.shopName, parsed.value.zip);
  } catch (error) {
    if (error instanceof DatabaseConfigError) {
      return { errors: {}, values, formError: error.message };
    }
    throw error;
  }

  return {
    errors: {},
    values,
    success: "Shop details saved.",
  };
}

function stringField(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}
