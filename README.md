# contributor-stats

A dashboard of git statistics for each contributor across several repositories.

- **`collector/`** – a Node.js (TypeScript) CLI. It reads the history of your local git clones and writes
  `web/public/data/stats.json`. It only runs `git log`; it never talks to GitHub or any other service.
- **`web/`** – a Vite + React + TypeScript single-page app that loads `stats.json` and displays it.
  No backend and no database: the build output is a folder of static files.

Until you collect your own data, the dashboard shows a bundled sample with invented names.

## Setup

Requires Node.js 20 or newer and `git` on your `PATH`.

```bash
npm install
```

One install at the root covers both parts (npm workspaces).

## Configure your repositories

```bash
cp repos.config.example.json repos.config.json     # Windows: copy repos.config.example.json repos.config.json
```

Then edit `repos.config.json`:

```json
{
  "repos": [
    { "name": "storefront", "path": "C:\\Users\\you\\code\\storefront" },
    { "name": "payments-api", "path": "/home/you/code/payments-api" }
  ],
  "excludePaths": ["package-lock.json", "pnpm-lock.yaml", "yarn.lock", "dist/", "build/", "node_modules/", "*.min.js", "*.map"],
  "identities": {
    "Manoj": ["manoj.150283@gmail.com", "manojktechie@gmail.com"]
  },
  "ignoreAuthors": ["dependabot[bot]"]
}
```

| Key | Meaning |
| --- | --- |
| `repos` | Local clones to read. `name` is what the dashboard shows and must be unique. `path` should be absolute. |
| `excludePaths` | Globs for generated files. Optional; the list above is the default. Setting it replaces the default. |
| `identities` | Merges several emails (or author names) into one person, shown under the key you choose. |
| `ignoreAuthors` | Author names or emails to drop, for example bots. `*` is a wildcard: `"*[bot]"`. |

**Windows paths.** JSON needs backslashes doubled (`"C:\\code\\repo"`). Forward slashes work too (`"C:/code/repo"`).

**`excludePaths` patterns.** A trailing slash (`dist/`) matches a directory at any depth. A pattern without a slash
(`*.min.js`) matches the file name at any depth. A pattern with a slash (`docs/api/**`) is matched from the repo root.

## Run the collector

```bash
npm run collect
```

Options: `npm run collect -- --config other.json --out somewhere/stats.json`.

For every repo it runs `git log --all --no-merges --numstat`, then a second pass with `--merges` to count merge commits.
Per person and per repo it records commits, merge commits, unique files touched, lines added and deleted (with and
without `excludePaths`), active days, first and last commit, the ten most-edited files, and a per-day series that the
dashboard uses for its date filter and weekly charts.

Things worth knowing:

- **All branches are counted**, including remote-tracking ones, so run `git fetch` in each clone first if you want
  current numbers. Stashes are left out.
- **Binary files are skipped** (git reports no line counts for them).
- **Renamed files** are counted under their new name.
- **Days** are taken from the author date in the author's own time zone.
- If a path is missing or is not a git repository, the collector stops with a message naming it and writes nothing.

### Merging identities

People often commit under more than one name or email. The collector:

1. merges identities that share an email address (ignoring case) automatically;
2. merges whatever you list together under `identities`;
3. prints the remaining look-alikes at the end of the run, without merging them:

```text
Possible duplicates that were NOT merged (1).
If two of these are the same person, list their emails under one name in "identities":

  - Manoj <manoj.150283@gmail.com>
    Manoj K <manojktechie@gmail.com>
    (one name is contained in the other)
```

Add them to `identities` and run `npm run collect` again.

## Run the dashboard

```bash
npm run dev        # local dev server with hot reload
npm run build      # type-checks both parts, then builds static files into web/dist
npm run preview    # serves web/dist locally to check the build
```

`web/dist` can be hosted on any static file host, in any folder: asset URLs are relative and routing uses the URL hash.
The data is read when the page loads, so after a new `npm run collect` just refresh in dev, or rebuild for a deployed copy.

What is in it:

- **Overview** – a sortable table of all contributors across repos, with a repo filter, a date-range filter and an
  "Exclude generated files" toggle that switches the line counts. Charts: commits per contributor, weekly commits per
  contributor, and each repo's commits split by contributor.
- **Contributor page** – totals, per-repo breakdown, weekly activity, first and last commit, most-edited files.
- **Repo page** – the same breakdown for a single repo.
- The header shows when the data was collected and from how many repos. Light and dark themes.

Two limits of a static data file: unique-file counts and most-edited files always cover the whole history (the
dashboard marks them when a date range is active), and charts name the seven most active contributors and group the
rest as "Others". The tables always list everyone.

## Privacy

- `repos.config.json` and `web/public/data/stats.json` are in `.gitignore`. Only the example config and the invented
  sample data (`web/public/data/stats.sample.json`) are committed.
- **Email addresses are never written to `stats.json`** and never shown in the UI; only names are. Local repo paths
  are not written either. Emails appear only in the collector's terminal output, so you can fill in `identities`.
- `npm run build` copies `stats.json` into `web/dist` if it exists. That is what makes the built site show your data,
  so treat `web/dist` as containing real names and file paths when you decide where to host it.

## Tests

```bash
npm test
```

The git-log parser, identity merging and aggregation are tested against fixture log output in
`collector/test/fixtures`, not a real repository. The dashboard's filtering and bucketing has its own tests.

`npm run sample` regenerates the sample data set.

## Layout

```text
collector/src/parseGitLog.ts   git log --numstat parser
collector/src/identities.ts    identity merging and the look-alike report
collector/src/aggregate.ts     per-person, per-repo statistics
collector/src/paths.ts         excludePaths matcher
collector/src/index.ts         CLI entry point
web/src/lib/aggregate.ts       filtering and chart series, computed in the browser
web/src/pages/                 overview, contributor and repo pages
```
