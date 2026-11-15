import { brands, PAYLOAD_URL } from "@payload-solutions/brand";
import {
	ActionRow,
	IndependenceNote,
	ProseLink,
} from "@payload-solutions/brand/lattice";
import { Parallax } from "@payload-solutions/brand/parallax";
import { SplitLoad } from "@payload-solutions/brand/split-load";
import { AssembleStack } from "@/components/assemble-stack";
import { CopyCommand } from "@/components/copy-command";
import { LaunchFilm } from "@/components/launch-film";

const brand = brands.stack;

/**
 * The hero. The headline states the transformation rather than the category — the category
 * itself ("SaaS boilerplate") is carried by the lead, the title tag and brands.stack.tagline,
 * so the page answers "what is this?" without spending the h1 on it.
 * The headline is the only large thing on the page; everything you can do with it
 * is a row of the lattice under the headline rather than a cluster of buttons, which is what
 * gives payloadcms.com its document-like calm. Columns two to four show the command at work:
 * the create-payload-stack transcript assembles the stack layer by layer, then each layer
 * lifts in turn and the database swaps adapters (see components/assemble-stack.tsx). It
 * stands on true black — an isometric floor behind it competed with the drawing's own isometry.
 */
export function Hero() {
	return (
		<section className="relative" aria-labelledby="hero-heading">
			<div className="container-content col-grid relative min-h-[calc(100dvh-var(--header-height))] items-center gap-y-14 py-20 lg:py-24">
				{/* The payloadcms.com convention, as on payload.solutions: from lg everything you read
            or press lives in the first of the four lattice columns, and the visual takes the
            other three. The headline steps down a size there so it sets inside one column, and
            the action rows close on the first grid line. */}
				<div className="reveal-load-group lg:col-span-1">
					<SplitLoad
						as="h1"
						id="hero-heading"
						className="display-xl max-w-[15ch] lg:max-w-none lg:text-[length:clamp(2.25rem,3.1vw,3.25rem)]"
					>
						<ProseLink href={PAYLOAD_URL}>Payload CMS</ProseLink>, ready for
						SaaS.
					</SplitLoad>
					<p className="lead mt-7 max-w-[30rem] lg:text-[1.0625rem] lg:leading-[1.5]">
						An agent-ready SaaS boilerplate for Payload, with authentication,
						organizations, billing, and an admin dashboard already wired in—so
						your coding agents can start building your product from day one.
					</p>

					<LaunchFilm className="mt-8" />

					<div className="mt-11 border-t border-border">
						<CopyCommand
							variant="row"
							className="lg:text-left lg:text-[0.875rem]"
						/>
						<ActionRow href={brand.docsUrl}>Documentation</ActionRow>
						<ActionRow href="/when-to-choose">
							When to choose Payload Stack
						</ActionRow>
					</div>

					<IndependenceNote className="mt-8" />
				</div>

				{/* Three columns from lg, starting a gap past the first grid line: the breathing room
            payloadcms.com leaves between its copy and its imagery. */}
				<Parallax
					speed={-0.08}
					className="min-w-0 lg:col-span-3 lg:pl-[clamp(1.5rem,3vw,3.5rem)]"
				>
					<AssembleStack className="mx-auto w-full max-w-[20rem] sm:max-w-[26rem] md:max-w-[44rem] lg:max-w-[54rem]" />
				</Parallax>
			</div>
		</section>
	);
}
