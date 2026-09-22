import { Workflow } from '@hailer/app-sdk';

/**
 * Creates a resolver that maps field key-or-ID → fieldId.
 *
 * Usage:
 *   const workflow = app.workflows.find(w => w._id === WORKFLOW_ID);
 *   const f = createFieldResolver(workflow?.fields);
 *   const value = activity.fields?.[f('matchDate')];
 *
 * - If input is already a field ID (exists in workflow.fields), returns it as-is.
 * - If input matches a field's `key` property, returns that field's hex ID.
 * - Falls back to the input unchanged (for workflows without keys).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFieldResolver(workflowFields: Record<string, any> | undefined) {
  const keyToId: Record<string, string> = {};

  if (workflowFields) {
    for (const [fieldId, fieldDef] of Object.entries(workflowFields)) {
      if (fieldDef?.key) {
        keyToId[fieldDef.key] = fieldId;
      }
    }
  }

  return (keyOrId: string): string => {
    if (workflowFields && keyOrId in workflowFields) return keyOrId;
    if (keyOrId in keyToId) return keyToId[keyOrId];
    return keyOrId;
  };
}

/**
 * Hook-friendly wrapper: resolves fields for a specific workflow from the app state.
 *
 * Usage:
 *   const { app } = useApp();
 *   const f = useFieldResolver(app.workflows, WORKFLOW_ID);
 *   const date = activity.fields?.[f('matchDate')];
 */
export function useFieldResolver(workflows: Workflow[], workflowId: string) {
  const workflow = workflows.find(w => w._id === workflowId);
  return createFieldResolver(workflow?.fields);
}
