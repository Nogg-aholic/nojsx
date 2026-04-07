import { nojsxComponentLoaders } from "nojsx/core/global/registry";
import * as M0 from "./pages/contact.js";
import * as M1 from "./pages/home.js";
import * as M2 from "./pages/projects.js";
const __g = globalThis;
__g.__nojsxComponentLoaders = __g.__nojsxComponentLoaders ?? nojsxComponentLoaders ?? {};
if (M0 && M0["ContactPage"]) {
  __g.__nojsxComponentLoaders["ContactPage"] = (props) => new M0["ContactPage"](props);
}
if (M1 && M1["HomePage"]) {
  __g.__nojsxComponentLoaders["HomePage"] = (props) => new M1["HomePage"](props);
}
if (M2 && M2["ProjectsPage"]) {
  __g.__nojsxComponentLoaders["ProjectsPage"] = (props) => new M2["ProjectsPage"](props);
}
export const nojsxPageRoutes = {
  "/contact": { componentName: "ContactPage" },
  "/home": { componentName: "HomePage" },
  "/projects": { componentName: "ProjectsPage" },
};
__g.__nojsxPageRoutes = nojsxPageRoutes;
export const nojsxPages = {
  "ContactPage": "/contact",
  "HomePage": "/home",
  "ProjectsPage": "/projects",
};
__g.__nojsxPages = nojsxPages;
