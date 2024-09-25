import type { MDXProps } from "mdx/types";
import { type Component, type JSX, lazy } from "solid-js";

import "./help_page.css";

export function HelperContainer(props: {
    children?: JSX.Element;
}) {
    return (
        <div class="growable-container">
            <div class="help-container">{props.children}</div>
        </div>
    );
}

export function lazyMdx(fn: () => Promise<{ default: Component<MDXProps> }>) {
    const MDXPage = lazy(fn);
    return () => <MDXPage />;
}
