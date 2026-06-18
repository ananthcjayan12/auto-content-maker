PRAGMA foreign_keys = ON;

INSERT INTO business_brand_systems (
  business_slug,
  business_name,
  phone,
  website_url,
  logo_url,
  brand_reference_board_url,
  colors_json,
  typography_json,
  visual_style_json,
  default_poster_rules_json
) VALUES (
  'dr-poojas-smile-craft',
  'Dr Pooja’s Smile Craft Dental Clinic',
  '7907006842',
  'https://drpoojassmilecraftdental.com/',
  'https://placehold.co/900x360/0EA5A4/FFFFFF.png?text=Dr+Pooja%27s+Smile+Craft+Logo',
  'https://placehold.co/1200x900/F7E7CE/123333.png?text=Brand+Reference+Board',
  '{"primary":"#008E8C","secondary":"#DFF7F7","accent":"#FFFFFF","darkText":"#071529","mutedText":"#5F7478"}',
  '{"headingStyle":"bold geometric sans-serif with heavy display weight for hero words","bodyStyle":"clean modern sans-serif with generous spacing and high clarity","fontMood":"premium, clinical, confident, celebratory, polished social poster"}',
  '{"mood":"premium dental clinic, clean white space, teal clinical luxury","layout":"bold hierarchy, large hero typography, curved photo masks, fine divider lines, dental sparkle accents","photoStyle":"bright clinic photography, teal-accented interiors, clean equipment, soft daylight, polished but real","avoid":["crowded flyer look","generic hospital emergency look","random stock dental icons","discount-heavy offer poster styling","too many colors outside teal, navy, white, and soft aqua","cartoon teeth unless specifically requested"]}',
  '["Use deep teal as the main brand color and deep navy for high-impact text","Keep the background mostly white or very pale aqua","Use bold oversized typography for the main message","Use refined dental sparkle accents and thin divider lines sparingly","Use rounded or curved image masks inspired by the reference posters","Use clinic name and phone number exactly","Keep text readable on mobile","Prefer 9:16 Instagram story aspect ratio unless otherwise specified"]'
)
ON CONFLICT(business_slug) DO UPDATE SET
  business_name = excluded.business_name,
  phone = excluded.phone,
  website_url = excluded.website_url,
  logo_url = excluded.logo_url,
  brand_reference_board_url = excluded.brand_reference_board_url,
  colors_json = excluded.colors_json,
  typography_json = excluded.typography_json,
  visual_style_json = excluded.visual_style_json,
  default_poster_rules_json = excluded.default_poster_rules_json,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

INSERT INTO daily_poster_packets (
  business_slug,
  poster_type,
  poster_date,
  status,
  headline,
  subheadline,
  cta,
  offer,
  campaign_goal,
  target_audience,
  required_text_json,
  production_reference_image_url,
  additional_reference_images_json,
  special_instructions_json,
  chatgpt_image_prompt
) VALUES (
  'dr-poojas-smile-craft',
  'awareness',
  '2026-06-18',
  'ready',
  'A Cleaner Smile Starts Here',
  'Gentle dental cleaning for a healthier smile',
  'Book your appointment today',
  NULL,
  'Create awareness and encourage appointment booking',
  'Local families and adults looking for dental care',
  '["Dr Pooja’s Smile Craft Dental Clinic","7907006842"]',
  'https://placehold.co/1080x1920/E7F7F6/123333.png?text=Today%27s+Dental+Cleaning+Reference',
  '[]',
  '["Use the production reference image as the main visual inspiration","Keep the design premium and minimal","Do not make it look like a cheap offer flyer"]',
  'Create a 9:16 premium modern dental clinic poster using the full context on this page. Use the brand colors, logo reference, brand reference board, and today''s production reference image. Include the clinic name and phone number exactly.'
)
ON CONFLICT(business_slug, poster_type, poster_date) DO UPDATE SET
  status = excluded.status,
  headline = excluded.headline,
  subheadline = excluded.subheadline,
  cta = excluded.cta,
  offer = excluded.offer,
  campaign_goal = excluded.campaign_goal,
  target_audience = excluded.target_audience,
  required_text_json = excluded.required_text_json,
  production_reference_image_url = excluded.production_reference_image_url,
  additional_reference_images_json = excluded.additional_reference_images_json,
  special_instructions_json = excluded.special_instructions_json,
  chatgpt_image_prompt = excluded.chatgpt_image_prompt,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');
