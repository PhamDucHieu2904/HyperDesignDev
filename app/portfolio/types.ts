export type Category = "photoshop" | "illustrator" | "blender" | "game" | "web" | "app";
export type Filter = "all" | Category;

export type PortfolioMedia = {
  src: string;
  alt: string;
  width: number;
  height: number;
  fit?: "cover" | "contain";
};

export type ProjectSection = {
  id: string;
  eyebrow: string;
  title: string;
  copy: string;
  media?: PortfolioMedia;
};

export type PortfolioProject = {
  id: string;
  title: string;
  shortTitle: string;
  summary: string;
  primaryCategory: Category;
  discipline: "design" | "development";
  tags: string[];
  status: "draft" | "published" | "placeholder";
  order: number;
  thumbnail: PortfolioMedia;
  cover: PortfolioMedia;
  role: string;
  year: string;
  tools: string[];
  sections: ProjectSection[];
};
