| Model | Repo | Effort | Session time | Total tokens¹ | Production LOC² | Unit tests | Build | Native e2e |
|---|---|---|---:|---:|---:|---:|---|---|
| Sonnet 5 | `sonnet5-runner` | high | 14m 02s | 14,947,926 | 1,029 | 15 passed | Static; no build step | unavailable |
| Sonnet 5.5 | `sonnet55-runner` | high | 34m 57s | 14,440,237 | 3,500 | 83 passed | passed | 24 passed |
| Opus 5 | `opus5-runner` | high | 26m 52s | 10,499,151 | 3,591 | 96 passed | passed | unavailable |
| Opus 5.5 | `opus55-runner` | high | 23m 03s | 8,280,038 | 2,779 | 29 passed | passed | 21 passed |

¹ Observed request usage including repeated cache reads. ² Physical lines including comments/blanks in production source, HTML and CSS.
