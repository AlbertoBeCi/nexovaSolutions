import { redirect } from "next/navigation";

type SearchParams = Record<string, string | string[] | undefined>;

export function redirectToInventory(path: string, params: SearchParams): never {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const item of value) query.append(key, item);
    } else if (value !== undefined) {
      query.set(key, value);
    }
  }
  const search = query.toString();
  redirect(search ? `${path}?${search}` : path);
}
