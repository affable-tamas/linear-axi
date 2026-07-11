import { describe, expect, it } from "vitest";
import { createSkillMarkdown, SKILL_BODY, SKILL_NAME } from "../src/skill.js";

describe("skill", () => {
  it("generates stable skill frontmatter", () => {
    const markdown = createSkillMarkdown();
    expect(markdown).toContain(`name: ${SKILL_NAME}`);
    expect(markdown).toContain("npx -y linear-axi");
    expect(markdown).toContain(SKILL_BODY.slice(0, 40));
  });
});
