import { LinearClient, type Issue, type IssueSearchResult, type Team, type User } from "@linear/sdk";
import { AxiError } from "axi-sdk-js";
import type { Env } from "./env.js";
import { loadEnv } from "./env.js";
import { DEFAULT_OAUTH_CLIENT_ID, refreshOAuthToken } from "./oauth.js";
import { isNotFoundError } from "./utils.js";

export interface Credentials {
  kind: "apiKey" | "accessToken";
  value: string;
}

export interface AuthStatus {
  authenticated: boolean;
  method: "apiKey" | "accessToken" | "none";
  viewer?: { id: string; name: string; email: string };
}

export interface IssueSummary {
  id: string;
  identifier: string;
  title: string;
  state: string;
  assignee: string;
  updatedAt: string;
  url: string;
}

export interface IssueDetail extends IssueSummary {
  description: string;
  priority: number;
  team: string;
}

export interface CommentSummary {
  id: string;
  author: string;
  body: string;
  createdAt: string;
}

export interface TeamSummary {
  id: string;
  key: string;
  name: string;
}

export interface LabelSummary {
  id: string;
  name: string;
  color: string;
}

export interface StateSummary {
  id: string;
  name: string;
  type: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  state: string;
}

export interface UserSummary {
  id: string;
  name: string;
  email: string;
}

export interface ResolvedRef {
  kind: "team" | "issue" | "state" | "user" | "label";
  id: string;
  key?: string;
  name: string;
}

export interface ResolveResult {
  resolved?: ResolvedRef;
  candidates?: ResolvedRef[];
  ambiguous?: boolean;
}

export function credentialsFromEnv(env: Env): Credentials | undefined {
  const apiKey = env.LINEAR_API_KEY;
  if (apiKey && apiKey.length > 0) {
    return { kind: "apiKey", value: apiKey };
  }
  const accessToken = env.LINEAR_ACCESS_TOKEN;
  if (accessToken && accessToken.length > 0) {
    return { kind: "accessToken", value: accessToken };
  }
  return undefined;
}

export class LinearGateway {
  private readonly env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  private async getClient(): Promise<LinearClient> {
    const apiKey = this.env.LINEAR_API_KEY;
    if (apiKey && apiKey.length > 0) {
      return new LinearClient({ apiKey });
    }

    const accessToken = await this.ensureAccessToken();
    return new LinearClient({ accessToken });
  }

  private async ensureAccessToken(): Promise<string> {
    const token = this.env.LINEAR_ACCESS_TOKEN;
    if (!token || token.length === 0) {
      throw new AxiError(
        "Linear credentials are not configured",
        "AUTH_ERROR",
        [
          "Set LINEAR_API_KEY or LINEAR_ACCESS_TOKEN",
          "Run `linear-axi auth login --write-env` for OAuth",
        ],
      );
    }

    const expiresAt = this.env.LINEAR_OAUTH_EXPIRES_AT;
    const refreshToken = this.env.LINEAR_OAUTH_REFRESH_TOKEN;
    const clientId =
      this.env.LINEAR_OAUTH_CLIENT_ID ?? DEFAULT_OAUTH_CLIENT_ID;

    if (!expiresAt || !refreshToken) {
      return token;
    }

    const expiryMs = new Date(expiresAt).getTime();
    if (Number.isNaN(expiryMs) || Date.now() < expiryMs - 60_000) {
      return token;
    }

    const refreshed = await refreshOAuthToken({
      clientId,
      refreshToken,
    });
    this.env.LINEAR_ACCESS_TOKEN = refreshed.access_token;
    this.env.LINEAR_OAUTH_EXPIRES_AT = new Date(
      Date.now() + refreshed.expires_in * 1000,
    ).toISOString();
    if (refreshed.refresh_token) {
      this.env.LINEAR_OAUTH_REFRESH_TOKEN = refreshed.refresh_token;
    }
    return refreshed.access_token;
  }

  async authStatus(): Promise<AuthStatus> {
    const credentials = credentialsFromEnv(this.env);
    if (!credentials) {
      return { authenticated: false, method: "none" };
    }
    const client = await this.getClient();
    const viewer = await client.viewer;
    return {
      authenticated: true,
      method: credentials.kind,
      viewer: {
        id: viewer.id,
        name: viewer.name,
        email: viewer.email,
      },
    };
  }

  async listTeams(limit: number): Promise<TeamSummary[]> {
    const client = await this.getClient();
    const teams = await client.teams({ first: limit });
    return teams.nodes.map(teamSummary);
  }

  async listIssues(input: {
    limit: number;
    assignee?: string;
    team?: string;
    state?: string;
  }): Promise<{ issues: IssueSummary[]; total?: number }> {
    const client = await this.getClient();

    if (input.state && !input.team) {
      throw new AxiError(
        "--team is required when filtering by --state",
        "VALIDATION_ERROR",
        ["Usage: linear-axi issues list --team ENG --state \"In Progress\""],
      );
    }

    if (input.team) {
      const team = await this.findTeam(input.team);
      const viewer = input.assignee === "me" ? await client.viewer : undefined;
      const stateId = input.state
        ? (await this.findState(input.state, team.id)).id
        : undefined;

      const filter: {
        state?: { id: { eq: string } };
        assignee?: { id: { eq: string } };
      } = {};
      if (stateId) {
        filter.state = { id: { eq: stateId } };
      }
      if (viewer) {
        filter.assignee = { id: { eq: viewer.id } };
      }

      const issues = await team.issues({
        first: input.limit,
        filter: Object.keys(filter).length > 0 ? filter : undefined,
      });
      const summaries = await Promise.all(issues.nodes.map(issueSummary));
      return {
        issues: summaries,
        total: issues.pageInfo.hasNextPage ? undefined : summaries.length,
      };
    }

    if (input.assignee === "me") {
      const viewer = await client.viewer;
      const issues = await viewer.assignedIssues({ first: input.limit });
      const summaries = await Promise.all(issues.nodes.map(issueSummary));
      return { issues: summaries };
    }

    const issues = await client.issues({ first: input.limit });
    const summaries = await Promise.all(issues.nodes.map(issueSummary));
    return { issues: summaries };
  }

  async searchIssues(input: {
    query: string;
    team?: string;
    limit: number;
  }): Promise<IssueSummary[]> {
    const client = await this.getClient();
    const teamId = input.team
      ? (await this.findTeam(input.team)).id
      : undefined;
    const results = await client.searchIssues(input.query, {
      first: input.limit,
      filter: teamId ? { team: { id: { eq: teamId } } } : undefined,
    });
    return Promise.all(results.nodes.map(searchResultSummary));
  }

  async viewIssue(id: string): Promise<{
    issue: IssueDetail;
    comments: CommentSummary[];
    commentTotal?: number;
  }> {
    const client = await this.getClient();
    const issue = await this.findIssue(id);
    const detail = await issueDetail(issue);
    const commentsConn = await issue.comments({ first: 5 });
    const comments = await Promise.all(
      commentsConn.nodes.map(async (comment) => {
        const user = await comment.user;
        return {
          id: comment.id,
          author: user?.name ?? "unknown",
          body: comment.body,
          createdAt: comment.createdAt.toISOString().slice(0, 10),
        };
      }),
    );
    return {
      issue: detail,
      comments,
      commentTotal: commentsConn.pageInfo.hasNextPage
        ? undefined
        : comments.length,
    };
  }

  async createIssue(input: {
    team: string;
    title: string;
    description?: string;
  }): Promise<IssueSummary> {
    const client = await this.getClient();
    const team = await this.findTeam(input.team);
    const payload = await client.createIssue({
      teamId: team.id,
      title: input.title,
      description: input.description,
    });
    if (!payload.success || !payload.issue) {
      throw new Error("Linear did not create the issue");
    }
    return issueSummary(await payload.issue);
  }

  async updateIssue(input: {
    id: string;
    title?: string;
    description?: string;
  }): Promise<IssueSummary> {
    const client = await this.getClient();
    const issue = await this.findIssue(input.id);
    const payload = await client.updateIssue(issue.id, {
      title: input.title,
      description: input.description,
    });
    if (!payload.success || !payload.issue) {
      throw new Error("Linear did not update the issue");
    }
    return issueSummary(await payload.issue);
  }

  async assignIssue(input: {
    id: string;
    user: string;
  }): Promise<{ issue: IssueSummary; noop: boolean }> {
    const client = await this.getClient();
    const issue = await this.findIssue(input.id);
    const user = await this.findUser(input.user);
    const currentAssignee = await issue.assignee;
    if (currentAssignee?.id === user.id) {
      return { issue: await issueSummary(issue), noop: true };
    }
    const payload = await client.updateIssue(issue.id, {
      assigneeId: user.id,
    });
    if (!payload.success || !payload.issue) {
      throw new Error("Linear did not assign the issue");
    }
    return { issue: await issueSummary(await payload.issue), noop: false };
  }

  async setIssueState(input: {
    id: string;
    state: string;
  }): Promise<{ issue: IssueSummary; noop: boolean }> {
    const client = await this.getClient();
    const issue = await this.findIssue(input.id);
    const team = await issue.team;
    const state = await this.findState(input.state, team?.id);
    const currentState = await issue.state;
    if (currentState?.id === state.id) {
      return { issue: await issueSummary(issue), noop: true };
    }
    const payload = await client.updateIssue(issue.id, {
      stateId: state.id,
    });
    if (!payload.success || !payload.issue) {
      throw new Error("Linear did not update issue state");
    }
    return { issue: await issueSummary(await payload.issue), noop: false };
  }

  async createComment(input: {
    issue: string;
    body: string;
  }): Promise<CommentSummary & { issueId: string; url: string }> {
    const client = await this.getClient();
    const issue = await this.findIssue(input.issue);
    const payload = await client.createComment({
      issueId: issue.id,
      body: input.body,
    });
    if (!payload.success || !payload.comment) {
      throw new Error("Linear did not create the comment");
    }
    const comment = await payload.comment;
    const user = await comment.user;
    return {
      id: comment.id,
      issueId: issue.id,
      author: user?.name ?? "unknown",
      body: comment.body,
      createdAt: comment.createdAt.toISOString().slice(0, 10),
      url: issue.url,
    };
  }

  async listLabels(teamKey?: string): Promise<LabelSummary[]> {
    const client = await this.getClient();
    if (teamKey) {
      const team = await this.findTeam(teamKey);
      const labels = await team.labels({ first: 100 });
      return labels.nodes.map((label) => ({
        id: label.id,
        name: label.name,
        color: label.color,
      }));
    }
    const labels = await client.issueLabels({ first: 100 });
    return labels.nodes.map((label) => ({
      id: label.id,
      name: label.name,
      color: label.color,
    }));
  }

  async listStates(teamKey?: string): Promise<StateSummary[]> {
    const client = await this.getClient();
    if (!teamKey) {
      throw new AxiError(
        "--team is required for states list",
        "VALIDATION_ERROR",
        ["Usage: linear-axi states list --team <key>"],
      );
    }
    const team = await this.findTeam(teamKey);
    const states = await team.states();
    return states.nodes.map((state) => ({
      id: state.id,
      name: state.name,
      type: state.type,
    }));
  }

  async listProjects(limit: number): Promise<ProjectSummary[]> {
    const client = await this.getClient();
    const projects = await client.projects({ first: limit });
    return Promise.all(
      projects.nodes.map(async (project) => ({
        id: project.id,
        name: project.name,
        state: project.state,
      })),
    );
  }

  async usersMe(): Promise<UserSummary> {
    const client = await this.getClient();
    const viewer = await client.viewer;
    return { id: viewer.id, name: viewer.name, email: viewer.email };
  }

  async resolveTeam(query: string): Promise<ResolveResult> {
    const client = await this.getClient();
    if (isUuid(query)) {
      const team = await client.team(query);
      return {
        resolved: {
          kind: "team",
          id: team.id,
          key: team.key,
          name: team.name,
        },
      };
    }
    const teams = await client.teams({ first: 50 });
    const matches = teams.nodes.filter(
      (t) =>
        t.key.toLowerCase() === query.toLowerCase() ||
        t.name.toLowerCase().includes(query.toLowerCase()),
    );
    return resolveMatches(
      "team",
      matches.map((t) => ({
        kind: "team" as const,
        id: t.id,
        key: t.key,
        name: t.name,
      })),
    );
  }

  async resolveIssue(query: string): Promise<ResolveResult> {
    const client = await this.getClient();
    try {
      const issue = await client.issue(query);
      const summary = await issueSummary(issue);
      return {
        resolved: {
          kind: "issue",
          id: issue.id,
          key: summary.identifier,
          name: summary.title,
        },
      };
    } catch (error) {
      if (isNotFoundError(error)) {
        return { candidates: [], ambiguous: false };
      }
      throw error;
    }
  }

  async resolveState(query: string, teamKey?: string): Promise<ResolveResult> {
    if (!teamKey) {
      throw new AxiError(
        "--team is required to resolve a state",
        "VALIDATION_ERROR",
        ["Usage: linear-axi resolve --state \"In Progress\" --team ENG"],
      );
    }
    const team = await this.findTeam(teamKey);
    const states = await team.states();
    const matches = states.nodes.filter((s) =>
      s.name.toLowerCase().includes(query.toLowerCase()),
    );
    return resolveMatches(
      "state",
      matches.map((s) => ({
        kind: "state" as const,
        id: s.id,
        name: s.name,
      })),
    );
  }

  async resolveUser(query: string): Promise<ResolveResult> {
    const client = await this.getClient();
    const users = await client.users({ first: 50 });
    const matches = users.nodes.filter(
      (u) =>
        u.email.toLowerCase() === query.toLowerCase() ||
        u.name.toLowerCase().includes(query.toLowerCase()) ||
        u.displayName.toLowerCase().includes(query.toLowerCase()),
    );
    return resolveMatches(
      "user",
      matches.map((u) => ({
        kind: "user" as const,
        id: u.id,
        name: u.name,
        key: u.email,
      })),
    );
  }

  private async findTeam(keyOrId: string): Promise<Team> {
    const client = await this.getClient();
    if (isUuid(keyOrId)) {
      return client.team(keyOrId);
    }
    const teams = await client.teams({
      first: 10,
      filter: { key: { eqIgnoreCase: keyOrId } },
    });
    const match = teams.nodes.find(
      (team) => team.key.toLowerCase() === keyOrId.toLowerCase(),
    );
    if (!match) {
      throw new AxiError(
        `No Linear team matched ${keyOrId}`,
        "NOT_FOUND",
        ["Run `linear-axi teams list` to see team keys"],
      );
    }
    return match;
  }

  private async findIssue(idOrKey: string): Promise<Issue> {
    const client = await this.getClient();
    return client.issue(idOrKey);
  }

  private async findUser(emailOrName: string): Promise<User> {
    const result = await this.resolveUser(emailOrName);
    if (result.ambiguous) {
      throw new AxiError(
        `Ambiguous user match for ${emailOrName}`,
        "VALIDATION_ERROR",
        result.candidates?.map((c) => `Candidate: ${c.name} <${c.key}>`) ?? [],
      );
    }
    if (!result.resolved) {
      throw new AxiError(
        `No user matched ${emailOrName}`,
        "NOT_FOUND",
        ["Run `linear-axi users me` or try an email address"],
      );
    }
    const client = await this.getClient();
    return client.user(result.resolved.id);
  }

  private async findState(
    nameOrId: string,
    teamId?: string,
  ): Promise<{ id: string; name: string }> {
    if (isUuid(nameOrId)) {
      return { id: nameOrId, name: nameOrId };
    }
    if (!teamId) {
      throw new AxiError(
        "Team context is required to resolve workflow state",
        "VALIDATION_ERROR",
        ["Pass --team when filtering or changing state"],
      );
    }
    const client = await this.getClient();
    const team = await client.team(teamId);
    const states = await team.states();
    const matches = states.nodes.filter((s) =>
      s.name.toLowerCase().includes(nameOrId.toLowerCase()),
    );
    if (matches.length === 0) {
      throw new AxiError(
        `No workflow state matched ${nameOrId}`,
        "NOT_FOUND",
        ["Run `linear-axi states list --team <key>`"],
      );
    }
    if (matches.length > 1) {
      throw new AxiError(
        `Ambiguous workflow state ${nameOrId}`,
        "VALIDATION_ERROR",
        matches.map((s) => `Candidate: ${s.name}`),
      );
    }
    return { id: matches[0]!.id, name: matches[0]!.name };
  }
}

function teamSummary(team: Team): TeamSummary {
  return { id: team.id, key: team.key, name: team.name };
}

async function searchResultSummary(result: IssueSearchResult): Promise<IssueSummary> {
  const state = await result.state;
  const assignee = await result.assignee;
  return {
    id: result.id,
    identifier: result.identifier,
    title: result.title,
    state: state?.name ?? "unknown",
    assignee: assignee?.name ?? "unassigned",
    updatedAt: result.updatedAt.toISOString().slice(0, 10),
    url: result.url,
  };
}

async function issueSummary(issue: Issue): Promise<IssueSummary> {
  const state = await issue.state;
  const assignee = await issue.assignee;
  return {
    id: issue.id,
    identifier: issue.identifier,
    title: issue.title,
    state: state?.name ?? "unknown",
    assignee: assignee?.name ?? "unassigned",
    updatedAt: issue.updatedAt.toISOString().slice(0, 10),
    url: issue.url,
  };
}

async function issueDetail(issue: Issue): Promise<IssueDetail> {
  const summary = await issueSummary(issue);
  const team = await issue.team;
  return {
    ...summary,
    description: issue.description ?? "",
    priority: issue.priority,
    team: team?.key ?? "unknown",
  };
}

function resolveMatches(
  _kind: ResolvedRef["kind"],
  matches: ResolvedRef[],
): ResolveResult {
  if (matches.length === 1) {
    return { resolved: matches[0] };
  }
  if (matches.length > 1) {
    return { candidates: matches, ambiguous: true };
  }
  return { candidates: [], ambiguous: false };
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export function makeGateway(env?: Env): LinearGateway {
  return new LinearGateway(env ?? loadEnv());
}
