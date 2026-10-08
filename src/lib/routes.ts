// GitHub Pages serves directory routes with a trailing slash.
export const adminPath = "/admin/";

export const projectRoutes = [
  { label: "Ойнеловские дали", path: "/projects/oynelovskie-dali/" },
  { label: "Другие участки", path: "/projects/drugie-uchastki/" },
] as const;
