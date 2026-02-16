export function slugifyCompany(name) {
  return (name ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
   .replace(/^-+/g, "")
.replace(/-+$/g, "")
}

