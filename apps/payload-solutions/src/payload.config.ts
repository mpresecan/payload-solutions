import { consentPlugin } from "@payload-solutions/plugin-consent";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { resendAdapter } from "@payloadcms/email-resend";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { s3Storage } from "@payloadcms/storage-s3";
import path from "path";
import { buildConfig, type Plugin } from "payload";
import sharp from "sharp";
import { fileURLToPath } from "url";

import {
	ContactSubmissions,
	Media,
	Plugins,
	Products,
	RoadmapItems,
	Users,
} from "@/collections";
import { seed } from "@/seed";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3200";

/** Reads a variable the active storage adapter cannot run without. */
function requireEnv(name: string): string {
	const value = process.env[name];
	if (!value) throw new Error(`${name} is required for Cloudflare R2 media storage`);
	return value;
}

// Media storage: Cloudflare R2 through its S3-compatible API (@payloadcms/storage-r2 needs a
// Workers bucket binding; this site runs Next.js on Node). Without R2_BUCKET uploads stay on
// local disk (./media), which is fine in development and lost on every Vercel deploy.
const r2PublicUrl = process.env.R2_PUBLIC_URL?.replace(/\/+$/, "");
const storagePlugins: Plugin[] = process.env.R2_BUCKET
	? [
			s3Storage({
				collections: {
					media: r2PublicUrl
						? {
								// Serve files from the bucket's public URL or custom domain instead of through Payload.
								disablePayloadAccessControl: true,
								generateFileURL: ({ filename, prefix }) =>
									`${r2PublicUrl}/${prefix ? `${prefix}/${filename}` : filename}`,
							}
						: true,
				},
				bucket: process.env.R2_BUCKET,
				config: {
					credentials: {
						accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
						secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
					},
					// R2 requires region "auto" and path-style addressing.
					region: "auto",
					endpoint: requireEnv("R2_ENDPOINT"),
					forcePathStyle: true,
				},
			}),
		]
	: [];

export default buildConfig({
	admin: {
		user: Users.slug,
		importMap: { baseDir: path.resolve(dirname) },
		components: {
			providers: [{ path: "@/components/reveal", exportName: "PostHogIdentify" }],
		},
		meta: { titleSuffix: " | Payload Solutions" },
	},
	collections: [
		Products,
		Plugins,
		RoadmapItems,
		ContactSubmissions,
		Media,
		Users,
	],
	editor: lexicalEditor(),
	secret: process.env.PAYLOAD_SECRET || "",
	serverURL: siteUrl,
	typescript: {
		outputFile: path.resolve(dirname, "payload-types.ts"),
	},
	db: postgresAdapter({
		pool: {
			connectionString: process.env.DATABASE_URL || "",
		},
	}),
	email: process.env.RESEND_API_KEY
		? resendAdapter({
				apiKey: process.env.RESEND_API_KEY,
				defaultFromAddress: "hello@payload.solutions",
				defaultFromName: "Payload Solutions",
			})
		: undefined,
	sharp,
	onInit: async (payload) => {
		// Seeding must never take the app down: a transient database error, or two cold starts
		// racing on the first insert, would otherwise fail init for every request.
		try {
			await seed(payload);
		} catch (err) {
			payload.logger.error({ err }, "Seeding skipped");
		}
	},
	plugins: [
		// Cookie Consent: banner config, cookie categories, trackers, consent records and the
		// legal pages, all under Privacy in the admin. The seed runs once, into empty collections
		// only, so it never overwrites an editor's changes.
		consentPlugin({
			seed: {
				company: {
					name: "Payload Solutions",
					legalName: "Fortbit d.o.o.",
					address: "Gradiščak 31A, 40313, Gradiščak, Croatia",
					email: "hello@payload.solutions",
					url: "https://fortbit.hr",
					jurisdictions: ["EEA"],
					governingLaw: "Croatia",
				},
				// PostHog is initialised in instrumentation-client.ts, so it is an `sdk` tracker:
				// declared here for the banner and the cookie policy, gated in code by PostHogConsent.
				trackers: [
					{
						key: "posthog-eu",
						vars: { projectKey: process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN ?? "" },
					},
				],
				// Created unverified: confirm each entity and DPA under Privacy → Processors.
				processors: ["vercel", "resend", "posthog-eu"],
			},
		}),
		...storagePlugins,
	],
});
