UPDATE poster_prompt_settings
SET poster_type_prompts_json = json_set(
  poster_type_prompts_json,
  '$.review',
  'POSTER TYPE: PATIENT REVIEW
Purpose: present authentic patient feedback as credible social proof.
When a review screenshot is supplied, the screenshot itself is the testimonial and must be placed prominently in the final poster. Preserve the supplied screenshot as one intact, readable rectangular image. Do not transcribe, retype, recreate, paraphrase, summarize, restyle, crop, mask, blur, or replace any review text, patient name, initials, avatar, rating, attribution, date, or platform UI visible inside it. Do not generate a separate quotation from the screenshot. You may add only minimal clinic-owned framing text outside the screenshot, such as a headline or CTA.
Create one short, warm, original social-proof headline outside the screenshot. Use ideas such as “A new review,” “Another happy smile,” “Kind words from our patient,” “Another reason to smile,” or “Your trust makes us smile” as creative direction, not mandatory wording. Keep it natural, premium, and mobile-readable. Vary the headline between posters. Do not imply a verified customer count, guaranteed happiness, treatment outcome, or medical result.
When only pasted review text is supplied and no screenshot exists, preserve its meaning and never invent a rating, patient identity, treatment result, or before-and-after claim.'
),
updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');
