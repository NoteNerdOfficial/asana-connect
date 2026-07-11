import { requestUrl } from "obsidian";
import {
  AsanaTask,
  AsanaUser,
  AsanaWorkspace,
  AsanaProject,
  CreateTaskParams,
} from "./types";

const BASE = "https://app.asana.com/api/1.0";
const TASK_FIELDS =
  "gid,name,notes,completed,due_on,assignee.name,assignee.gid,projects.gid,projects.name,tags.gid,tags.name,permalink_url,created_at,modified_at,custom_fields.gid,custom_fields.name,custom_fields.display_value";

interface AsanaRequestOptions {
  method?: string;
  body?: string;
  headers?: Record<string, string>;
}

interface AsanaEnvelope<T> {
  data: T;
}

export class AsanaAPI {
  constructor(private pat: string) {}

  async request<T = unknown>(path: string, options: AsanaRequestOptions = {}): Promise<T> {
    const res = await requestUrl({
      url: `${BASE}${path}`,
      method: options.method ?? "GET",
      headers: {
        Authorization: `Bearer ${this.pat}`,
        "Content-Type": "application/json",
        ...(options.headers ?? {}),
      },
      body: options.body,
      throw: false,
    });
    if (res.status >= 400) {
      throw new Error(`Asana API error ${res.status}: ${res.text}`);
    }
    const json = res.json as AsanaEnvelope<T>;
    return json.data;
  }

  async getMe(): Promise<AsanaUser> {
    return this.request("/users/me?opt_fields=gid,name,email,workspaces.gid,workspaces.name");
  }

  async getTask(gid: string): Promise<AsanaTask> {
    return this.request(`/tasks/${gid}?opt_fields=${TASK_FIELDS}`);
  }

  async getMyTasks(workspaceGid: string): Promise<AsanaTask[]> {
    await this.getMe();
    return this.request(
      `/tasks?assignee=me&workspace=${workspaceGid}&completed_since=now&opt_fields=${TASK_FIELDS}&limit=100`
    );
  }

  async getProjectTasks(projectGid: string): Promise<AsanaTask[]> {
    return this.request(
      `/projects/${projectGid}/tasks?opt_fields=${TASK_FIELDS}&limit=100`
    );
  }

  async searchTasks(workspaceGid: string, query: string): Promise<AsanaTask[]> {
    const params = new URLSearchParams({
      text: query,
      opt_fields: TASK_FIELDS,
      limit: "20",
    });
    return this.request(`/workspaces/${workspaceGid}/tasks/search?${params}`);
  }

  async getProjects(workspaceGid: string): Promise<AsanaProject[]> {
    return this.request(
      `/projects?workspace=${workspaceGid}&opt_fields=gid,name,color,permalink_url&limit=100`
    );
  }

  async getWorkspaces(): Promise<AsanaWorkspace[]> {
    const me = await this.getMe();
    return me.workspaces;
  }

  async createTask(params: CreateTaskParams): Promise<AsanaTask> {
    return this.request(`/tasks?opt_fields=${TASK_FIELDS}`, {
      method: "POST",
      body: JSON.stringify({ data: params }),
    });
  }

  async completeTask(gid: string): Promise<AsanaTask> {
    return this.request(`/tasks/${gid}?opt_fields=${TASK_FIELDS}`, {
      method: "PUT",
      body: JSON.stringify({ data: { completed: true } }),
    });
  }

  async uncompleteTask(gid: string): Promise<AsanaTask> {
    return this.request(`/tasks/${gid}?opt_fields=${TASK_FIELDS}`, {
      method: "PUT",
      body: JSON.stringify({ data: { completed: false } }),
    });
  }

  async updateTask(gid: string, fields: Record<string, unknown>): Promise<AsanaTask> {
    return this.request(`/tasks/${gid}?opt_fields=${TASK_FIELDS}`, {
      method: "PUT",
      body: JSON.stringify({ data: fields }),
    });
  }

  extractGidFromUrl(url: string): string | null {
    const match = url.match(/\/(\d+)\/?(?:\?|$)/);
    return match ? match[1] : null;
  }
}
