import {
  forwardRef,
  useContext,
  type ComponentPropsWithoutRef,
} from "react";
import styled from "styled-components";
import {
  headingLevelForDepth,
  SectionDepthContext,
  type HeadingLevel,
} from "./section-depth-context";

export type HeadingProps = ComponentPropsWithoutRef<"h1">;

export const Heading = forwardRef<HTMLHeadingElement, HeadingProps>(
  function Heading(props, ref) {
    const sectionDepth = useContext(SectionDepthContext);
    const level = headingLevelForDepth(sectionDepth);

    return <HeadingElement as={headingTag(level)} ref={ref} {...props} />;
  },
);

function headingTag(level: HeadingLevel): `h${HeadingLevel}` {
  return `h${level}`;
}

const HeadingElement = styled.h1`
  margin: 0;
  color: inherit;
  font: inherit;
`;
