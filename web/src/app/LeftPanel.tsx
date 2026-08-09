import { useState } from "react";
import type { ProjectSnapshotNode } from "@shared/project-snapshot.js";
import styled, { useTheme } from "styled-components";
import { tokens, type ThemeValues } from "~/app/theme";
import { fileState } from "~/components/fileState";

interface LeftPanelProps {
  nodes: readonly ProjectSnapshotNode[];
  onFileSelect: (fileId: string) => void;
  selectedFileId?: string;
}

export interface FileTreeDirectory {
  directories: FileTreeDirectory[];
  files: ProjectSnapshotNode[];
  name: string;
  path: string;
}

interface MutableFileTreeDirectory {
  directories: Map<string, MutableFileTreeDirectory>;
  files: ProjectSnapshotNode[];
  name: string;
  path: string;
}

export function LeftPanel({
  nodes,
  onFileSelect,
  selectedFileId,
}: LeftPanelProps) {
  const theme = useTheme();
  const [query, setQuery] = useState("");
  const [expandedDirectories, setExpandedDirectories] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const visibleFiles = filterFiles(nodes, query);
  const fileTree = buildFileTree(visibleFiles);
  const revealSearchResults = query.trim().length > 0;

  function toggleDirectory(path: string) {
    setExpandedDirectories((currentDirectories) => {
      const nextDirectories = new Set(currentDirectories);

      if (nextDirectories.has(path)) {
        nextDirectories.delete(path);
      } else {
        nextDirectories.add(path);
      }

      return nextDirectories;
    });
  }

  return (
    <Panel aria-label="Project panel">
      <PanelHeader>
        <Title>Project</Title>
        <Description>Browse the analyzed source files.</Description>
      </PanelHeader>
      <SearchArea>
        <SearchLabel htmlFor="project-file-search">Search files</SearchLabel>
        <SearchControl>
          <SearchIcon aria-hidden="true">⌕</SearchIcon>
          <SearchInput
            autoComplete="off"
            id="project-file-search"
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Search files"
            spellCheck="false"
            type="search"
            value={query}
          />
        </SearchControl>
      </SearchArea>
      <FileSection aria-labelledby="project-files-heading">
        <FileSectionHeader>
          <FileSectionTitle id="project-files-heading">Files</FileSectionTitle>
          <FileCount aria-label={`${visibleFiles.length} files shown`}>
            {visibleFiles.length}
          </FileCount>
        </FileSectionHeader>
        {visibleFiles.length > 0 ? (
          <FileList>
            <DirectoryContents
              depth={0}
              directory={fileTree}
              expandedDirectories={expandedDirectories}
              fileStateColors={theme.colors.fileState}
              onDirectoryToggle={toggleDirectory}
              onFileSelect={onFileSelect}
              revealAllDirectories={revealSearchResults}
              selectedFileId={selectedFileId}
            />
          </FileList>
        ) : (
          <EmptyState>
            {nodes.length === 0 ? "No files loaded yet." : "No matching files."}
          </EmptyState>
        )}
      </FileSection>
    </Panel>
  );
}

interface DirectoryContentsProps {
  depth: number;
  directory: FileTreeDirectory;
  expandedDirectories: ReadonlySet<string>;
  fileStateColors: ThemeValues["colors"]["fileState"];
  onDirectoryToggle: (path: string) => void;
  onFileSelect: (fileId: string) => void;
  revealAllDirectories: boolean;
  selectedFileId?: string;
}

function DirectoryContents({
  depth,
  directory,
  expandedDirectories,
  fileStateColors,
  onDirectoryToggle,
  onFileSelect,
  revealAllDirectories,
  selectedFileId,
}: DirectoryContentsProps) {
  return (
    <>
      {directory.directories.map((childDirectory) => {
        const isExpanded =
          revealAllDirectories || expandedDirectories.has(childDirectory.path);

        return (
          <DirectoryItem key={childDirectory.path}>
            <FolderButton
              $depth={depth}
              aria-expanded={isExpanded}
              onClick={() => onDirectoryToggle(childDirectory.path)}
              title={childDirectory.path}
              type="button"
            >
              <DisclosureIcon $expanded={isExpanded} aria-hidden="true">
                ›
              </DisclosureIcon>
              <FolderIcon aria-hidden="true" />
              <FolderName>{childDirectory.name}</FolderName>
            </FolderButton>
            {isExpanded ? (
              <NestedFileList>
                <DirectoryContents
                  depth={depth + 1}
                  directory={childDirectory}
                  expandedDirectories={expandedDirectories}
                  fileStateColors={fileStateColors}
                  onDirectoryToggle={onDirectoryToggle}
                  onFileSelect={onFileSelect}
                  revealAllDirectories={revealAllDirectories}
                  selectedFileId={selectedFileId}
                />
              </NestedFileList>
            ) : null}
          </DirectoryItem>
        );
      })}
      {directory.files.map((node) => {
        const state = fileState(node);

        return (
          <FileListItem key={node.id}>
            <FileButton
              $depth={depth}
              $selected={node.id === selectedFileId}
              aria-current={node.id === selectedFileId ? "true" : undefined}
              onClick={() => onFileSelect(node.id)}
              title={node.path}
              type="button"
            >
              <FileStateDot
                $color={fileStateColors[state]}
                aria-hidden="true"
              />
              <FileName>{node.name}</FileName>
            </FileButton>
          </FileListItem>
        );
      })}
    </>
  );
}

export function filterFiles(
  nodes: readonly ProjectSnapshotNode[],
  query: string,
): ProjectSnapshotNode[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  return nodes
    .filter((node) =>
      normalizedQuery.length === 0
        ? true
        : node.path.toLocaleLowerCase().includes(normalizedQuery),
    )
    .toSorted((first, second) => first.path.localeCompare(second.path));
}

export function buildFileTree(
  nodes: readonly ProjectSnapshotNode[],
): FileTreeDirectory {
  const root: MutableFileTreeDirectory = {
    directories: new Map(),
    files: [],
    name: "",
    path: "",
  };

  nodes.forEach((node) => {
    const pathParts = node.path.split("/").filter(Boolean);
    const directoryNames = pathParts.slice(0, -1);
    let currentDirectory = root;
    let currentPath = "";

    directoryNames.forEach((directoryName) => {
      currentPath = currentPath
        ? `${currentPath}/${directoryName}`
        : directoryName;
      const existingDirectory = currentDirectory.directories.get(directoryName);

      if (existingDirectory) {
        currentDirectory = existingDirectory;
        return;
      }

      const nextDirectory: MutableFileTreeDirectory = {
        directories: new Map(),
        files: [],
        name: directoryName,
        path: currentPath,
      };
      currentDirectory.directories.set(directoryName, nextDirectory);
      currentDirectory = nextDirectory;
    });

    currentDirectory.files.push(node);
  });

  return finalizeDirectory(root);
}

function finalizeDirectory(
  directory: MutableFileTreeDirectory,
): FileTreeDirectory {
  return {
    directories: [...directory.directories.values()]
      .toSorted((first, second) => first.name.localeCompare(second.name))
      .map(finalizeDirectory),
    files: directory.files.toSorted((first, second) =>
      first.name.localeCompare(second.name),
    ),
    name: directory.name,
    path: directory.path,
  };
}

const Panel = styled.aside`
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid ${tokens.colors.border};
  background: ${tokens.colors.surface};
`;

const PanelHeader = styled.header`
  padding: 15px 13px;
  border-bottom: 1px solid ${tokens.colors.border};
`;

const Title = styled.h2`
  margin: 0;
  font-size: ${tokens.typography.size.sm};
  font-weight: ${tokens.typography.weight.semibold};
`;

const Description = styled.p`
  margin: 5px 0 0;
  color: ${tokens.colors.textMuted};
  font-size: ${tokens.typography.size.xs};
  line-height: ${tokens.typography.lineHeight.normal};
`;

const SearchArea = styled.div`
  padding: 12px 13px;
  border-bottom: 1px solid ${tokens.colors.border};
`;

const SearchLabel = styled.label`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
`;

const SearchControl = styled.div`
  position: relative;
`;

const SearchIcon = styled.span`
  position: absolute;
  top: 50%;
  left: 9px;
  color: ${tokens.colors.textMuted};
  font-size: ${tokens.typography.size.md};
  line-height: 1;
  pointer-events: none;
  transform: translateY(-50%);
`;

const SearchInput = styled.input`
  width: 100%;
  height: 32px;
  padding: 0 28px;
  border: 1px solid ${tokens.colors.border};
  border-radius: 6px;
  color: ${tokens.colors.text};
  background: ${tokens.colors.surfaceRaised};
  font: inherit;
  font-size: ${tokens.typography.size.sm};

  &::placeholder {
    color: ${tokens.colors.textMuted};
  }

  &:focus-visible {
    outline: 2px solid ${tokens.colors.accent};
    outline-offset: -1px;
  }

  &::-webkit-search-cancel-button {
    cursor: pointer;
  }
`;

const FileSection = styled.section`
  min-height: 0;
  display: flex;
  flex: 1;
  flex-direction: column;
`;

const FileSectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 13px 7px;
`;

const FileSectionTitle = styled.h3`
  margin: 0;
  color: ${tokens.colors.textMuted};
  font-size: ${tokens.typography.size.xs};
  font-weight: ${tokens.typography.weight.semibold};
  letter-spacing: ${tokens.typography.letterSpacing.wide};
  text-transform: uppercase;
`;

const FileCount = styled.span`
  color: ${tokens.colors.textMuted};
  font-family: ${tokens.typography.family.mono};
  font-size: ${tokens.typography.size.xs};
`;

const FileList = styled.ul`
  min-height: 0;
  margin: 0;
  padding: 0 7px 10px;
  overflow-y: auto;
  list-style: none;
`;

const NestedFileList = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
`;

const DirectoryItem = styled.li`
  min-width: 0;
`;

const FolderButton = styled.button<{ $depth: number }>`
  width: 100%;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 6px 6px ${({ $depth }) => `${$depth * 14 + 4}px`};
  border: 0;
  border-radius: 5px;
  color: ${tokens.colors.textMuted};
  background: transparent;
  text-align: left;
  cursor: pointer;

  &:hover {
    color: ${tokens.colors.text};
    background: ${tokens.colors.surfaceRaised};
  }

  &:focus-visible {
    outline: 2px solid ${tokens.colors.accent};
    outline-offset: -2px;
  }
`;

const DisclosureIcon = styled.span<{ $expanded: boolean }>`
  width: 8px;
  flex: none;
  font-size: ${tokens.typography.size.md};
  line-height: 1;
  transform: rotate(${({ $expanded }) => ($expanded ? "90deg" : "0deg")});
  transition: transform 120ms ease;

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const FolderIcon = styled.span`
  position: relative;
  width: 13px;
  height: 9px;
  flex: none;
  border: 1px solid currentColor;
  border-radius: 2px;

  &::before {
    position: absolute;
    top: -4px;
    left: -1px;
    width: 6px;
    height: 3px;
    border: 1px solid currentColor;
    border-bottom: 0;
    border-radius: 2px 2px 0 0;
    content: "";
  }
`;

const FolderName = styled.span`
  min-width: 0;
  overflow: hidden;
  font-family: ${tokens.typography.family.mono};
  font-size: ${tokens.typography.size.sm};
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const FileListItem = styled.li`
  min-width: 0;
`;

const FileButton = styled.button<{ $depth: number; $selected: boolean }>`
  width: 100%;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 6px 6px ${({ $depth }) => `${$depth * 14 + 18}px`};
  border: 0;
  border-radius: 5px;
  color: ${({ $selected }) =>
    $selected ? tokens.colors.text : tokens.colors.textMuted};
  background: ${({ $selected }) =>
    $selected ? tokens.colors.surfaceRaised : "transparent"};
  text-align: left;
  cursor: pointer;

  &:hover {
    color: ${tokens.colors.text};
    background: ${tokens.colors.surfaceRaised};
  }

  &:focus-visible {
    outline: 2px solid ${tokens.colors.accent};
    outline-offset: -2px;
  }
`;

const FileStateDot = styled.span<{ $color: string }>`
  width: 7px;
  height: 7px;
  flex: none;
  border-radius: 50%;
  background: ${({ $color }) => $color};
`;

const FileName = styled.span`
  min-width: 0;
  display: block;
  overflow: hidden;
  color: inherit;
  font-family: ${tokens.typography.family.mono};
  font-size: ${tokens.typography.size.sm};
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const EmptyState = styled.div`
  flex: 1;
  display: grid;
  place-items: center;
  padding: 24px 12px;
  color: ${tokens.colors.textMuted};
  font-size: ${tokens.typography.size.xs};
  text-align: center;
`;
