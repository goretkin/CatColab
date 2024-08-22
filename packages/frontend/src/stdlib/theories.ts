import * as catlog from "catlog-wasm";

import { TheoryMeta } from "../theory";
import { uniqueIndexArray } from "../util/indexing";
import { ModelGraphviz, StockFlowDiagram } from "./visualizations";

import styles from "./styles.module.css";
import svgStyles from "./svg_styles.module.css";

/** Standard library of double theories supported by frontend.

TODO: Should the underlying theories be lazy loaded?
 */
export const stdTheories = () =>
    uniqueIndexArray(
        [thSimpleOlog(), thSimpleSchema(), thRegNet(), thCausalLoop(), thStockFlow()],
        (th) => th.id,
    );

const thSimpleOlog = () =>
    new TheoryMeta({
        id: "simple-olog",
        name: "Olog",
        description: "Ontology log, a simple conceptual model",
        theory: catlog.thCategory,
        types: [
            {
                tag: "ObType",
                obType: { tag: "Basic", content: "Object" },
                name: "Type",
                description: "Type or class of things",
                shortcut: ["O"],
                cssClasses: [styles["corner-box"]],
                svgClasses: [svgStyles.box],
            },
            {
                tag: "MorType",
                morType: {
                    tag: "Hom",
                    content: { tag: "Basic", content: "Object" },
                },
                name: "Aspect",
                description: "Aspect or property of a thing",
                shortcut: ["M"],
            },
        ],
        modelViews: [
            {
                name: "Diagram",
                description: "Visualize the olog as a diagram",
                component: ModelGraphviz,
            },
        ],
    });

const thSimpleSchema = () =>
    new TheoryMeta({
        id: "schema",
        name: "Schema",
        description: "Schema for a categorical database",
        theory: catlog.thSchema,
        types: [
            {
                tag: "ObType",
                obType: { tag: "Basic", content: "Entity" },
                name: "Entity",
                description: "Type of entity or thing",
                shortcut: ["O"],
                cssClasses: [styles.box],
                svgClasses: [svgStyles.box],
                textClasses: [styles.code],
            },
            {
                tag: "MorType",
                morType: {
                    tag: "Hom",
                    content: { tag: "Basic", content: "Entity" },
                },
                name: "Mapping",
                description: "Many-to-one relation between entities",
                shortcut: ["M"],
                textClasses: [styles.code],
            },
            {
                tag: "MorType",
                morType: { tag: "Basic", content: "Attr" },
                name: "Attribute",
                description: "Data attribute of an entity",
                shortcut: ["A"],
                textClasses: [styles.code],
            },
            {
                tag: "ObType",
                obType: { tag: "Basic", content: "AttrType" },
                name: "Attribute type",
                description: "Data type for an attribute",
                textClasses: [styles.code],
            },
            {
                tag: "MorType",
                morType: {
                    tag: "Hom",
                    content: { tag: "Basic", content: "AttrType" },
                },
                name: "Operation",
                description: "Operation on data types for attributes",
                textClasses: [styles.code],
            },
        ],
        modelViews: [
            {
                name: "Diagram",
                description: "Visualize the schema as a diagram",
                component: ModelGraphviz,
            },
        ],
    });

const thRegNet = () =>
    new TheoryMeta({
        id: "reg-net",
        name: "Regulatory network",
        theory: catlog.thSignedCategory,
        onlyFreeModels: true,
        types: [
            {
                tag: "ObType",
                obType: { tag: "Basic", content: "Object" },
                name: "Species",
                shortcut: ["S"],
                description: "Biochemical species in the network",
            },
            {
                tag: "MorType",
                morType: {
                    tag: "Hom",
                    content: { tag: "Basic", content: "Object" },
                },
                name: "Promotion",
                shortcut: ["P"],
                description: "Positive interaction: activates or promotes",
                preferUnnamed: true,
            },
            {
                tag: "MorType",
                morType: { tag: "Basic", content: "Negative" },
                name: "Inhibition",
                shortcut: ["I"],
                description: "Negative interaction: represses or inhibits",
                arrowStyle: "flat",
                preferUnnamed: true,
            },
        ],
        modelViews: [
            {
                name: "Network",
                description: "Visualize the regulatory network",
                component: ModelGraphviz,
            },
        ],
    });

const thCausalLoop = () =>
    new TheoryMeta({
        id: "causal-loop",
        name: "Causal loop diagram",
        theory: catlog.thSignedCategory,
        onlyFreeModels: true,
        types: [
            {
                tag: "ObType",
                obType: { tag: "Basic", content: "Object" },
                name: "Variable",
                shortcut: ["V"],
                description: "Variable quantity",
            },
            {
                tag: "MorType",
                morType: {
                    tag: "Hom",
                    content: { tag: "Basic", content: "Object" },
                },
                name: "Positive link",
                shortcut: ["P"],
                description: "Variables change in the same direction",
                arrowStyle: "plus",
                preferUnnamed: true,
            },
            {
                tag: "MorType",
                morType: { tag: "Basic", content: "Negative" },
                name: "Negative link",
                shortcut: ["N"],
                description: "Variables change in the opposite direction",
                arrowStyle: "minus",
                preferUnnamed: true,
            },
        ],
        modelViews: [
            {
                name: "Diagram",
                description: "Visualize the causal loop diagram",
                component: ModelGraphviz,
            },
        ],
    });

const thStockFlow = () =>
    new TheoryMeta({
        id: "stock-flow",
        name: "Stock and flow",
        theory: catlog.thCategoryLinks,
        onlyFreeModels: true,
        types: [
            {
                tag: "ObType",
                obType: { tag: "Basic", content: "Object" },
                name: "Stock",
                description: "Thing with an amount",
                shortcut: ["S"],
                cssClasses: [styles.box],
                svgClasses: [svgStyles.box],
            },
            {
                tag: "MorType",
                morType: {
                    tag: "Hom",
                    content: { tag: "Basic", content: "Object" },
                },
                name: "Flow",
                description: "Flow from one stock to another",
                shortcut: ["F"],
                arrowStyle: "double",
            },
            {
                tag: "MorType",
                morType: { tag: "Basic", content: "Link" },
                name: "Link",
                description: "Influence of a stock on a flow",
                preferUnnamed: true,
                shortcut: ["L"],
            },
        ],
        modelViews: [
            {
                name: "Diagram",
                description: "Visualize the stock and flow diagram",
                component: StockFlowDiagram,
            },
        ],
    });