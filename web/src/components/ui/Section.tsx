import {
  forwardRef,
  useContext,
  type ComponentPropsWithoutRef,
} from "react";
import styled from "styled-components";
import {
  nextSectionDepth,
  SectionDepthContext,
} from "./section-depth-context";

export type SectionProps = ComponentPropsWithoutRef<"section">;

export const Section = forwardRef<HTMLElement, SectionProps>(
  function Section({ children, ...props }, ref) {
    const parentDepth = useContext(SectionDepthContext);
    const sectionDepth = nextSectionDepth(parentDepth);

    return (
      <SectionDepthContext.Provider value={sectionDepth}>
        <SectionElement ref={ref} {...props}>
          {children}
        </SectionElement>
      </SectionDepthContext.Provider>
    );
  },
);

const SectionElement = styled.section``;
