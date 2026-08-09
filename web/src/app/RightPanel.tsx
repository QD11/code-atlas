import { useState, type KeyboardEvent, type PointerEvent } from "react";
import type {
  ProjectSnapshotEdge,
  ProjectSnapshotNode,
} from "@shared/project-snapshot.js";
import styled from "styled-components";
import { tokens } from "~/app/theme";
import { Button, Heading, Section, Tag } from "~/components/ui";

const DEFAULT_WIDTH_PERCENT = 24;
const COLLAPSED_WIDTH = "2.25rem";
const MIN_WIDTH_PERCENT = 16;
const MAX_WIDTH_PERCENT = 45;
const KEYBOARD_STEP_PERCENT = 2;

interface RightPanelProps {
  edges: readonly ProjectSnapshotEdge[];
  isOpen: boolean;
  nodes: readonly ProjectSnapshotNode[];
  onOpenChange: (isOpen: boolean) => void;
  selectedFile?: ProjectSnapshotNode;
}

export function RightPanel({
  edges,
  isOpen,
  nodes,
  onOpenChange,
  selectedFile,
}: RightPanelProps) {
  const [widthPercent, setWidthPercent] = useState(DEFAULT_WIDTH_PERCENT);
  const [isResizing, setIsResizing] = useState(false);
  const importedRelationships = selectedFile
    ? fileRelationships(selectedFile.id, "imports", edges, nodes)
    : [];
  const importingRelationships = selectedFile
    ? fileRelationships(selectedFile.id, "imported-by", edges, nodes)
    : [];

  function resizeFromPointer(clientX: number) {
    const nextWidthPercent =
      ((window.innerWidth - clientX) / window.innerWidth) * 100;

    setWidthPercent(clampWidthPercent(nextWidthPercent));
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsResizing(true);
    resizeFromPointer(event.clientX);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      resizeFromPointer(event.clientX);
    }
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    resizeFromPointer(event.clientX);
    event.currentTarget.releasePointerCapture(event.pointerId);
    setIsResizing(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const nextWidth = {
      ArrowLeft: widthPercent + KEYBOARD_STEP_PERCENT,
      ArrowRight: widthPercent - KEYBOARD_STEP_PERCENT,
      Home: MIN_WIDTH_PERCENT,
      End: MAX_WIDTH_PERCENT,
    }[event.key];

    if (nextWidth === undefined) return;

    event.preventDefault();
    setWidthPercent(clampWidthPercent(nextWidth));
  }

  return (
    <Panel
      $isOpen={isOpen}
      $isResizing={isResizing}
      $widthPercent={widthPercent}
      aria-label="Details panel"
    >
      {isOpen ? (
        <>
          <ResizeHandle
            $isResizing={isResizing}
            aria-label="Resize details panel"
            aria-orientation="vertical"
            aria-valuemax={MAX_WIDTH_PERCENT}
            aria-valuemin={MIN_WIDTH_PERCENT}
            aria-valuenow={Math.round(widthPercent)}
            aria-valuetext={`${Math.round(widthPercent)} percent of the viewport`}
            onKeyDown={handleKeyDown}
            onLostPointerCapture={() => setIsResizing(false)}
            onPointerCancel={() => setIsResizing(false)}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            role="separator"
            tabIndex={0}
          />
          <PanelBody>
            <PanelHeader>
              <HeaderRow>
                <Title>Details</Title>
                <PanelButton
                  $inHeader
                  aria-expanded="true"
                  aria-label="Hide details panel"
                  onClick={() => {
                    onOpenChange(false);
                    setIsResizing(false);
                  }}
                  type="button"
                >
                  <span aria-hidden="true">›</span>
                </PanelButton>
              </HeaderRow>
              <Description>File dependencies and change impact.</Description>
            </PanelHeader>
            {selectedFile ? (
              <FileDetails
                importedRelationships={importedRelationships}
                importingRelationships={importingRelationships}
                selectedFile={selectedFile}
              />
            ) : (
              <EmptyState>
                Select a file in the graph to inspect its details.
              </EmptyState>
            )}
          </PanelBody>
        </>
      ) : (
        <PanelButton
          aria-expanded="false"
          aria-label="Show details panel"
          onClick={() => onOpenChange(true)}
          type="button"
        >
          <span aria-hidden="true">‹</span>
        </PanelButton>
      )}
    </Panel>
  );
}

function clampWidthPercent(widthPercent: number): number {
  return Math.min(MAX_WIDTH_PERCENT, Math.max(MIN_WIDTH_PERCENT, widthPercent));
}

interface FileRelationship {
  file: ProjectSnapshotNode;
  importedSymbols: string[];
}

function fileRelationships(
  fileId: string,
  relationship: "imports" | "imported-by",
  edges: readonly ProjectSnapshotEdge[],
  nodes: readonly ProjectSnapshotNode[],
): FileRelationship[] {
  return edges.flatMap((edge) => {
    const connectedId =
      relationship === "imports"
        ? edge.source === fileId
          ? edge.target
          : undefined
        : edge.target === fileId
          ? edge.source
          : undefined;
    const connectedFile = nodes.find(({ id }) => id === connectedId);

    return connectedFile
      ? [
          {
            file: connectedFile,
            importedSymbols: [
              ...new Set(
                edge.references.flatMap((reference) =>
                  reference.bindings.map((binding) => binding.importedName),
                ),
              ),
            ],
          },
        ]
      : [];
  });
}

interface FileDetailsProps {
  importedRelationships: readonly FileRelationship[];
  importingRelationships: readonly FileRelationship[];
  selectedFile: ProjectSnapshotNode;
}

function FileDetails({
  importedRelationships,
  importingRelationships,
  selectedFile,
}: FileDetailsProps) {
  return (
    <Details>
      <FileSummary>
        <FileName>{selectedFile.name}</FileName>
        <FilePath>{selectedFile.path}</FilePath>
        <StatusRow>
          <StatusLabel>Current change</StatusLabel>
          <StatusValue>
            {formatLabel(selectedFile.changeStatus ?? "unchanged")}
          </StatusValue>
        </StatusRow>
        {selectedFile.previousPath ? (
          <PreviousPath>Previously {selectedFile.previousPath}</PreviousPath>
        ) : null}
      </FileSummary>

      <DetailSection>
        <SectionTitle>Changed exports</SectionTitle>
        {selectedFile.changedExports.length > 0 ? (
          <DetailList>
            {selectedFile.changedExports.map((change) => (
              <ExportItem key={`${change.name}:${change.status}`}>
                <ItemName>{change.name}</ItemName>
                <Tag>{formatLabel(change.status)}</Tag>
              </ExportItem>
            ))}
          </DetailList>
        ) : (
          <EmptyDetail>No changed exports</EmptyDetail>
        )}
      </DetailSection>

      <DetailSection>
        <SectionTitle>Directly imports</SectionTitle>
        <RelationshipList
          emptyLabel="No internal imports"
          relationships={importedRelationships}
        />
      </DetailSection>

      <DetailSection>
        <SectionTitle>Imported by</SectionTitle>
        <RelationshipList
          emptyLabel="No internal importers"
          relationships={importingRelationships}
        />
      </DetailSection>

      <DetailSection>
        <SectionTitle>Why highlighted</SectionTitle>
        {selectedFile.impactReasons.length > 0 ? (
          <DetailList>
            {selectedFile.impactReasons.map((reason) => (
              <DetailItem
                key={`${reason.level}:${reason.origin.id}:${reason.distance}`}
              >
                <ItemName>{formatLabel(reason.level)}</ItemName>
                <ItemMeta>
                  {reason.origin.name} · {formatLabel(reason.origin.status)}
                </ItemMeta>
              </DetailItem>
            ))}
          </DetailList>
        ) : (
          <EmptyDetail>No change impact identified</EmptyDetail>
        )}
      </DetailSection>
    </Details>
  );
}

interface RelationshipListProps {
  emptyLabel: string;
  relationships: readonly FileRelationship[];
}

function RelationshipList({
  emptyLabel,
  relationships,
}: RelationshipListProps) {
  if (relationships.length === 0) {
    return <EmptyDetail>{emptyLabel}</EmptyDetail>;
  }

  return (
    <ScrollableRelationshipList>
      {relationships.map(({ file, importedSymbols }) => (
        <DetailItem key={file.id}>
          <ItemName>{file.path}</ItemName>
          <ImportedSymbolList aria-label="Imported symbols">
            {importedSymbols.length > 0 ? (
              importedSymbols.map((symbol) => (
                <ImportedSymbol key={symbol}>{symbol}</ImportedSymbol>
              ))
            ) : (
              <ImportedSymbol>Module import</ImportedSymbol>
            )}
          </ImportedSymbolList>
        </DetailItem>
      ))}
    </ScrollableRelationshipList>
  );
}

function formatLabel(value: string): string {
  return value
    .split("-")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

const Panel = styled.aside<{
  $isOpen: boolean;
  $isResizing: boolean;
  $widthPercent: number;
}>`
  position: relative;
  width: ${({ $isOpen, $widthPercent }) =>
    $isOpen ? `clamp(12rem, ${$widthPercent}vw, 35rem)` : COLLAPSED_WIDTH};
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  overflow: hidden;
  border-left: 1px solid ${tokens.colors.border};
  background: ${tokens.colors.surface};
  transition: ${({ $isResizing }) =>
    $isResizing ? "none" : "width 160ms ease"};

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  @media (max-width: 40rem) {
    width: ${({ $isOpen, $widthPercent }) =>
      $isOpen
        ? `clamp(min(10rem, 45vw), ${$widthPercent}vw, 45vw)`
        : COLLAPSED_WIDTH};
  }
`;

const ResizeHandle = styled.div<{ $isResizing: boolean }>`
  position: absolute;
  z-index: 1;
  top: 0;
  bottom: 0;
  left: -5px;
  width: 9px;
  cursor: col-resize;
  touch-action: none;

  &::after {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 4px;
    width: ${({ $isResizing }) => ($isResizing ? "2px" : "1px")};
    background: ${({ $isResizing }) =>
      $isResizing ? tokens.colors.accent : "transparent"};
    content: "";
    transform: translateX(-50%);
  }

  &:hover::after,
  &:focus-visible::after {
    width: 2px;
    background: ${tokens.colors.accent};
  }

  &:focus-visible {
    outline: none;
  }
`;

const PanelBody = styled(Section)`
  min-height: 0;
  display: flex;
  flex: 1;
  flex-direction: column;
`;

const PanelHeader = styled.header`
  padding: 15px 13px;
  border-bottom: 1px solid ${tokens.colors.border};
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`;

const PanelButton = styled(Button)<{ $inHeader?: boolean }>`
  width: 28px;
  min-width: 28px;
  min-height: 28px;
  margin: ${({ $inHeader }) => ($inHeader ? "0" : "7px auto")};
  padding: 0;
  font-size: ${tokens.typography.size.lg};
`;

const Title = styled(Heading)`
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

const EmptyState = styled.div`
  flex: 1;
  display: grid;
  place-items: center;
  padding: 24px;
  color: ${tokens.colors.textMuted};
  font-size: ${tokens.typography.size.sm};
  line-height: ${tokens.typography.lineHeight.normal};
  text-align: center;
`;

const Details = styled.div`
  min-height: 0;
  overflow-y: auto;
`;

const FileSummary = styled.div`
  padding: 15px 13px;
  border-bottom: 1px solid ${tokens.colors.border};
`;

const FileName = styled.div`
  overflow: hidden;
  font-family: ${tokens.typography.family.mono};
  font-size: ${tokens.typography.size.sm};
  font-weight: ${tokens.typography.weight.semibold};
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const FilePath = styled.div`
  margin-top: 5px;
  overflow-wrap: anywhere;
  color: ${tokens.colors.textMuted};
  font-family: ${tokens.typography.family.mono};
  font-size: ${tokens.typography.size.xs};
  line-height: ${tokens.typography.lineHeight.normal};
`;

const StatusRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 13px;
`;

const StatusLabel = styled.span`
  color: ${tokens.colors.textMuted};
  font-size: ${tokens.typography.size.xs};
`;

const StatusValue = styled.span`
  font-size: ${tokens.typography.size.xs};
  font-weight: ${tokens.typography.weight.medium};
`;

const PreviousPath = styled.div`
  margin-top: 7px;
  color: ${tokens.colors.textMuted};
  font-family: ${tokens.typography.family.mono};
  font-size: ${tokens.typography.size.xs};
  overflow-wrap: anywhere;
`;

const DetailSection = styled(Section)`
  padding: 13px;
  border-bottom: 1px solid ${tokens.colors.border};
`;

const SectionTitle = styled(Heading)`
  margin-bottom: 9px;
  color: ${tokens.colors.textMuted};
  font-size: ${tokens.typography.size.xs};
  font-weight: ${tokens.typography.weight.semibold};
  letter-spacing: ${tokens.typography.letterSpacing.wide};
  text-transform: uppercase;
`;

const DetailList = styled.ul`
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
`;

const ScrollableRelationshipList = styled(DetailList)`
  max-height: 11rem;
  overflow-y: auto;
  padding-right: 0.25rem;
  scrollbar-gutter: stable;
`;

const DetailItem = styled.li`
  min-width: 0;
`;

const ExportItem = styled(DetailItem)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`;

const ItemName = styled.div`
  min-width: 0;
  overflow: hidden;
  font-family: ${tokens.typography.family.mono};
  font-size: ${tokens.typography.size.sm};
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ItemMeta = styled.div`
  margin-top: 2px;
  overflow-wrap: anywhere;
  color: ${tokens.colors.textMuted};
  font-size: ${tokens.typography.size.xs};
  line-height: ${tokens.typography.lineHeight.normal};
`;

const ImportedSymbolList = styled.ul`
  display: grid;
  gap: 0.25rem;
  margin: 0.375rem 0 0;
  padding: 0;
  list-style: none;
`;

const ImportedSymbol = styled.li`
  padding: 0.25rem 0.5rem;
  border-left: 1px solid ${tokens.colors.border};
  color: ${tokens.colors.textMuted};
  font-family: ${tokens.typography.family.mono};
  font-size: ${tokens.typography.size.sm};
`;

const EmptyDetail = styled.p`
  margin: 0;
  color: ${tokens.colors.textMuted};
  font-size: ${tokens.typography.size.xs};
`;
