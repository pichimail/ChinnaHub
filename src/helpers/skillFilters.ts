import { AgentBrowserIdentifier, ArtifactsIdentifier } from '@lobechat/builtin-skills';
import { isDesktop } from '@lobechat/const';
import { type BuiltinSkill } from '@lobechat/types';

export interface BuiltinSkillFilterContext {
  isDesktop: boolean;
}

const DESKTOP_ONLY_BUILTIN_SKILLS = new Set([AgentBrowserIdentifier]);
const USER_HIDDEN_BUILTIN_SKILLS = new Set(['task']);
const DEFAULT_ACTIVATED_BUILTIN_SKILLS = [ArtifactsIdentifier];

const DEFAULT_CONTEXT: BuiltinSkillFilterContext = {
  isDesktop,
};

const resolveBuiltinSkillFilterContext = (
  context: BuiltinSkillFilterContext = DEFAULT_CONTEXT,
): BuiltinSkillFilterContext => ({
  isDesktop: context.isDesktop ?? DEFAULT_CONTEXT.isDesktop,
});

export const shouldEnableBuiltinSkill = (
  skillId: string,
  context: BuiltinSkillFilterContext = DEFAULT_CONTEXT,
): boolean => {
  const resolvedContext = resolveBuiltinSkillFilterContext(context);

  if (USER_HIDDEN_BUILTIN_SKILLS.has(skillId)) return false;

  if (DESKTOP_ONLY_BUILTIN_SKILLS.has(skillId)) {
    if (!resolvedContext.isDesktop) return false;
    return true;
  }

  return true;
};

export const filterBuiltinSkills = (
  skills: BuiltinSkill[],
  context: BuiltinSkillFilterContext = DEFAULT_CONTEXT,
): BuiltinSkill[] => {
  return skills.filter((skill) => shouldEnableBuiltinSkill(skill.identifier, context));
};

export const withDefaultBuiltinSkillIds = (skillIds: string[] = []): string[] => {
  return [...new Set([...skillIds, ...DEFAULT_ACTIVATED_BUILTIN_SKILLS])];
};

export { DEFAULT_ACTIVATED_BUILTIN_SKILLS, USER_HIDDEN_BUILTIN_SKILLS };
