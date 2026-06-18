flowchart TD
A[Cloudflare Cron Trigger<br/>Runs daily, ideally night before or early morning] --> B[Poster Orchestrator Worker]

    B --> C[Fetch Public Context JSON/HTML<br/>brand system, colors, logo, references]
    C --> D[Validate Context<br/>required text, logo, colors, poster type]

    D --> E[Determine Today's Angle<br/>India/Kerala + dental relevance]
    E --> F[Gemini Text Step<br/>create structured poster brief/prompt]

    F --> G[Prompt Builder<br/>combine brief + design rules + logo/style constraints]
    G --> H[Gemini Flash Image Batch Job<br/>1K full poster generation]

    H --> I[Batch Queue / Async Processing]
    I --> J[Poll Job Status or Webhook Callback]

    J --> K{Image returned?}
    K -- No --> L[Retry / Wait / Escalate]
    K -- Yes --> M[Validation Layer]

    M --> N{Pass checks?}
    N -- Yes --> O[Store Final Poster in R2]
    O --> P[Save Metadata in D1]
    P --> Q[Notify Admin<br/>email / dashboard / WhatsApp]

    N -- No --> R[Retry Once with revised prompt]
    R --> S{Retry passed?}
    S -- Yes --> O
    S -- No --> T[Fallback Path<br/>use Standard API or human review]

    T --> O
