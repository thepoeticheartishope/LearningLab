# Fact file data types

Each `data/facts/<id>.json` file is one object with three lists:

```json
{ "entities": [ ... ], "facts": [ ... ], "templates": [ ... ] }
```

## Entity

A thing a fact can name.

| Field | Type | Need | Notes |
|---|---|---|---|
| `id` | string | yes | Unique key used in facts, e.g. `"rj45"`. |
| `name` | string | yes | What players see, e.g. `"RJ45"`. |
| `type` | string | should | Area for grouping and wrong answers, e.g. `"connector"`, `"man"`. |
| `aliases` | string[] | no | Other accepted answers. |
| `acronym` | string | no | Short form (stored only, not used by the code yet). |

## Fact

One true S·P·O triple.

| Field | Type | Need | Notes |
|---|---|---|---|
| `subject` | string | yes | An entity `id`. |
| `predicate` | string | yes | Joins to a template's `predicate`, e.g. `"pin_count"`. |
| `object` | string or number | yes | An entity `id`, or a plain number (`8`, `950`). |
| `source` | string | yes | `"220-1201 3.2"` (CompTIA), `"Gen 9:29"` (Bible). |
| `role` | string | no | The object's job when one subject has several, e.g. `"data"`. |

## Template

How to ask about one predicate.

| Field | Type | Need | Notes |
|---|---|---|---|
| `predicate` | string | yes | The predicate it covers. One template per predicate. Every fact's predicate needs one. |
| `label` | string | no | Short name, e.g. `"{subject} pins"`. |
| `ask_object` | string | one of these two | Asks for the object: `"How many pins are in a {subject}?"` |
| `ask_subject` | string | one of these two | Asks for the subject: `"Name a child of {object}."` |
| `ask_object_role` | string | no | Asks per role: `"Which port does {subject} use for {role}?"` |
| `exhaustive` | string[] | no | Ways (`"ask_object"`, `"ask_subject"`) where the file lists every right answer. Ways left out are open lists. |
| `map` | object | no | Map line, see below. |
| `category` | string | no | e.g. `"Hardware"`, `"People"`. |
| `difficulty` | string | no | `"easy"`, `"medium"` or `"hard"`. |
| `group_object` | string | no | Pick screen group name for `ask_object` rows. |
| `group_subject` | string | no | Pick screen group name for `ask_subject` rows. |

### `map` object

| Field | Type | Need | Notes |
|---|---|---|---|
| `line` | string | yes | Words between the two ends, e.g. `"has"`, `"child of"`. |
| `kind` | string | no | `"info"` (default), `"risk"` or `"defence"`. |
| `object` | string | no | How the object end reads, e.g. `"{object} pins"`. |

## Placeholders

`{subject}`, `{object}` and `{role}` in template strings are filled with the entity name, the object name or number, and the fact's role.
