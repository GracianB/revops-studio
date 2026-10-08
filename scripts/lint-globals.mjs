import { ESLint } from "eslint";
import globals from "globals";

const eslint = new ESLint({
  overrideConfigFile: true,
  overrideConfig: [{
    files: ["assets/js/app.js","assets/js/site.js","assets/js/thanks.js","assets/js/contact-response.js"],
    languageOptions: {
      ecmaVersion:"latest", sourceType:"module",
      globals: { ...globals.browser, ...globals.es2024 }
    },
    rules: { "no-undef": "error" }
  }]
});
const results = await eslint.lintFiles(["assets/js/app.js","assets/js/site.js","assets/js/thanks.js","assets/js/contact-response.js"]);
const messages = results.flatMap(result=>result.messages.map(m=>
  result.filePath + ":" + m.line + ":" + m.column + " " + m.message
));
if(messages.length) {
  console.error("BROWSER VARIABLE SCOPE FAIL:\n"+messages.join("\n"));
  process.exitCode = 1;
} else {
  console.log("BROWSER VARIABLE SCOPE PASS");
}
