import { useState, type KeyboardEvent, type PointerEvent } from "react";
import styled from "styled-components";
import { tokens } from "~/app/theme";
import { Button } from "~/components/ui";

const DEFAULT_WIDTH = 300;
const COLLAPSED_WIDTH = 36;
const MIN_WIDTH = 240;
const MAX_WIDTH = 560;
const KEYBOARD_STEP = 16;

export function RightPanel() {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [isOpen, setIsOpen] = useState(true);
  const [isResizing, setIsResizing] = useState(false);

  function resizeFromPointer(clientX: number) {
    setWidth(clampWidth(window.innerWidth - clientX));
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
      ArrowLeft: width + KEYBOARD_STEP,
      ArrowRight: width - KEYBOARD_STEP,
      Home: MIN_WIDTH,
      End: MAX_WIDTH,
    }[event.key];

    if (nextWidth === undefined) return;

    event.preventDefault();
    setWidth(clampWidth(nextWidth));
  }

  return (
    <Panel
      $isResizing={isResizing}
      aria-label="Details panel"
      style={{ width: isOpen ? width : COLLAPSED_WIDTH }}
    >
      {isOpen ? (
        <>
          <ResizeHandle
            $isResizing={isResizing}
            aria-label="Resize details panel"
            aria-orientation="vertical"
            aria-valuemax={MAX_WIDTH}
            aria-valuemin={MIN_WIDTH}
            aria-valuenow={width}
            aria-valuetext={`${width} pixels wide`}
            onKeyDown={handleKeyDown}
            onLostPointerCapture={() => setIsResizing(false)}
            onPointerCancel={() => setIsResizing(false)}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            role="separator"
            tabIndex={0}
          />
          <PanelHeader>
            <HeaderRow>
              <Title>Details</Title>
              <PanelButton
                $inHeader
                aria-expanded="true"
                aria-label="Hide details panel"
                onClick={() => {
                  setIsOpen(false);
                  setIsResizing(false);
                }}
                type="button"
              >
                <span aria-hidden="true">›</span>
              </PanelButton>
            </HeaderRow>
            <Description>Selected file information will live here.</Description>
          </PanelHeader>
          <EmptyState>Right panel</EmptyState>
        </>
      ) : (
        <PanelButton
          aria-expanded="false"
          aria-label="Show details panel"
          onClick={() => setIsOpen(true)}
          type="button"
        >
          <span aria-hidden="true">‹</span>
        </PanelButton>
      )}
    </Panel>
  );
}

function clampWidth(width: number): number {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width));
}

const Panel = styled.aside<{ $isResizing: boolean }>`
  position: relative;
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

const EmptyState = styled.div`
  flex: 1;
  display: grid;
  place-items: center;
  color: ${tokens.colors.textMuted};
  font-size: ${tokens.typography.size.sm};
`;
