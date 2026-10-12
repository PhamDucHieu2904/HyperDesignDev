import type { Filter, PortfolioProject } from "./types";

export type PortfolioState = {
  category: Filter;
  query: string;
  projectId: string | null;
  indexExpanded: boolean;
  returnCategory: Filter;
  returnQuery: string;
  returnScroll: number;
};

export const initialPortfolioState: PortfolioState = {
  category: "all", query: "", projectId: null, indexExpanded: false,
  returnCategory: "all", returnQuery: "", returnScroll: 0,
};

export type PortfolioAction =
  | { type: "category"; value: Filter }
  | { type: "query"; value: string }
  | { type: "open"; project: PortfolioProject; scrollTop: number }
  | { type: "toggle-index" }
  | { type: "back" };

export function portfolioReducer(state: PortfolioState, action: PortfolioAction): PortfolioState {
  switch (action.type) {
    case "category": return { ...initialPortfolioState, category: action.value };
    case "query": return { ...state, category: "all", query: action.value, projectId: null };
    case "open": return {
      category: action.project.primaryCategory,
      query: "",
      projectId: action.project.id,
      indexExpanded: false,
      returnCategory: "all",
      returnQuery: state.projectId ? state.returnQuery : state.query,
      returnScroll: state.projectId ? state.returnScroll : action.scrollTop,
    };
    case "toggle-index": return { ...state, indexExpanded: !state.indexExpanded };
    case "back": return {
      ...initialPortfolioState,
      category: state.returnCategory,
      query: state.returnQuery,
      returnCategory: state.returnCategory,
      returnQuery: state.returnQuery,
      returnScroll: state.returnScroll,
    };
  }
}
