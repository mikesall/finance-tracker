import template from "../finance-core/ui/ledger-shell.html?raw";
import {siteProfile} from "./site";
const escape=(text:string)=>text.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]!));
export const shell=template.replace("__FINANCE_PAGE_TITLE__",escape(siteProfile.pageTitle));
