export interface AsanaWorkspace {
  gid: string;
  name: string;
}

export interface AsanaProject {
  gid: string;
  name: string;
  color?: string;
  permalink_url?: string;
}

export interface AsanaTag {
  gid: string;
  name: string;
}

export interface AsanaCustomField {
  gid: string;
  name: string;
  display_value: string | null;
}

export interface AsanaUser {
  gid: string;
  name: string;
  email?: string;
  workspaces: AsanaWorkspace[];
}

export interface AsanaTask {
  gid: string;
  name: string;
  notes: string;
  completed: boolean;
  due_on: string | null;
  assignee: { gid: string; name: string } | null;
  projects: AsanaProject[];
  tags: AsanaTag[];
  permalink_url: string;
  created_at: string;
  modified_at: string;
  custom_fields: AsanaCustomField[];
}

export interface CreateTaskParams {
  name: string;
  notes?: string;
  due_on?: string;
  workspace?: string;
  projects?: string[];
  assignee?: string;
}

export interface AsanaPluginSettings {
  pat: string;
  defaultWorkspaceGid: string;
  defaultWorkspaceName: string;
  defaultProjectGid: string;
  defaultProjectName: string;
  defaultAssignee: string;
  showCompletedTasks: boolean;
  taskListRefreshInterval: number;
}

export const DEFAULT_SETTINGS: AsanaPluginSettings = {
  pat: "",
  defaultWorkspaceGid: "",
  defaultWorkspaceName: "",
  defaultProjectGid: "",
  defaultProjectName: "",
  defaultAssignee: "me",
  showCompletedTasks: false,
  taskListRefreshInterval: 300,
};

export interface AsanaFrontmatter {
  "asana-task-gid"?: string;
  "asana-task-url"?: string;
  "asana-task-name"?: string;
  "asana-task-completed"?: boolean;
  "asana-due-on"?: string;
  "asana-assignee"?: string;
}
