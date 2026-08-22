/** Canonical Industry Use Cases tabs on the public homepage. */

export type UseCaseCatalogItem = {
  slug: string;
  name: string;
  icon: string;
  color: string;
  title: string;
  description: string;
  ctaLabel: string;
  categoryUid: string;
  showcaseUid: string;
  modelUid: string;
  sortOrder: number;
};

export const USE_CASE_CATALOG: UseCaseCatalogItem[] = [
  {
    slug: "furniture",
    name: "Furniture",
    icon: "Sofa",
    color: "#FF5733",
    title: "In-room placement",
    description: "True-scale sofas and chairs in the living room before checkout.",
    ctaLabel: "Start with Furniture",
    categoryUid: "cat_furniture",
    showcaseUid: "sh_furniture",
    modelUid: "wm_furniture",
    sortOrder: 1,
  },
  {
    slug: "tiles",
    name: "Tiles",
    icon: "Grid",
    color: "#33FF57",
    title: "Surface inspection",
    description: "Inspect shine, grout, and texture at architect-grade fidelity.",
    ctaLabel: "Start with Tiles",
    categoryUid: "cat_tiles",
    showcaseUid: "sh_tiles",
    modelUid: "wm_tiles",
    sortOrder: 2,
  },
  {
    slug: "shoes",
    name: "Shoes",
    icon: "Footprints",
    color: "#3357FF",
    title: "Detail & form",
    description: "Rotate every stitch and sole profile for confident buys.",
    ctaLabel: "Start with Footwear",
    categoryUid: "cat_shoes",
    showcaseUid: "sh_shoes",
    modelUid: "wm_shoes",
    sortOrder: 3,
  },
  {
    slug: "packaging",
    name: "Packaging",
    icon: "Box",
    color: "#F3FF33",
    title: "Print preview",
    description: "Validate labels and finishes before the print run.",
    ctaLabel: "Start with Packaging",
    categoryUid: "cat_packaging",
    showcaseUid: "sh_packaging",
    modelUid: "wm_packaging",
    sortOrder: 4,
  },
  {
    slug: "electronics",
    name: "Electronics",
    icon: "Laptop",
    color: "#33C1FF",
    title: "Product spin",
    description: "Show ports, finish, and form factor before unboxing.",
    ctaLabel: "Start with Electronics",
    categoryUid: "cat_electronics",
    showcaseUid: "sh_electronics",
    modelUid: "wm_electronics",
    sortOrder: 5,
  },
  {
    slug: "jewelry",
    name: "Jewelry",
    icon: "Gem",
    color: "#FF33A8",
    title: "Sparkle close-up",
    description: "Catch metal, stone, and craftsmanship in true scale.",
    ctaLabel: "Start with Jewelry",
    categoryUid: "cat_jewelry",
    showcaseUid: "sh_jewelry",
    modelUid: "wm_jewelry",
    sortOrder: 6,
  },
  {
    slug: "fashion",
    name: "Fashion",
    icon: "Shirt",
    color: "#A833FF",
    title: "Fit & drape",
    description: "Preview silhouette and material movement on product pages.",
    ctaLabel: "Start with Fashion",
    categoryUid: "cat_fashion",
    showcaseUid: "sh_fashion",
    modelUid: "wm_fashion",
    sortOrder: 7,
  },
  {
    slug: "automotive",
    name: "Automotive",
    icon: "Car",
    color: "#FF8C33",
    title: "Exterior detail",
    description: "Walk around trims, wheels, and paint finishes in 3D.",
    ctaLabel: "Start with Automotive",
    categoryUid: "cat_automotive",
    showcaseUid: "sh_automotive",
    modelUid: "wm_automotive",
    sortOrder: 8,
  },
];

export function getUseCaseFolder(slug: string) {
  return `use-cases/${slug}`;
}

export function isUploadedModelPath(filePath: string | null | undefined) {
  return Boolean(filePath && filePath.startsWith("/uploads/models/"));
}
