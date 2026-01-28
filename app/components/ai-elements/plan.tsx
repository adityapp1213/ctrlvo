import React from "react";

type PlanProps = React.HTMLAttributes<HTMLDivElement>;

export function Plan(props: PlanProps) {
  return <div {...props} />;
}

Plan.displayName = "Plan";
