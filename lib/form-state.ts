export type FormState = {
  formError?: string;
  success?: string;
  errors: Record<string, string>;
  values: Record<string, string>;
};

export const emptyFormState: FormState = { errors: {}, values: {} };

export function readValues(formData: FormData, keys: string[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const key of keys) {
    const value = formData.get(key);
    if (typeof value === "string") values[key] = value;
    else if (value == null) values[key] = "";
    else values[key] = "on";
  }
  return values;
}
