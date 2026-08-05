export type SourceFileChangeStatus =
  "added" | "modified" | "deleted" | "renamed";

export interface AddedSourceFileChange {
  status: "added";
  path: string;
}

export interface ModifiedSourceFileChange {
  status: "modified";
  path: string;
}

export interface DeletedSourceFileChange {
  status: "deleted";
  path: string;
}

export interface RenamedSourceFileChange {
  status: "renamed";
  path: string;
  previousPath: string;
}

export type SourceFileChange =
  | AddedSourceFileChange
  | ModifiedSourceFileChange
  | DeletedSourceFileChange
  | RenamedSourceFileChange;

export type GitChangeDiagnosticCode =
  | "git-unavailable"
  | "not-git-repository"
  | "no-head"
  | "git-command-failed"
  | "conflicted-file"
  | "unsupported-git-status"
  | "malformed-git-output";

export interface GitChangeDiagnostic {
  severity: "error" | "warning";
  code: GitChangeDiagnosticCode;
  message: string;
  path?: string;
}

export interface DetectGitChangesResult {
  projectRoot: string;
  repositoryRoot?: string;
  headCommit?: string;
  changes: SourceFileChange[];
  diagnostics: GitChangeDiagnostic[];
}
