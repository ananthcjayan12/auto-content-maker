UPDATE business_brand_systems
SET
  colors_json = '{"primary":"#008E8C","secondary":"#DFF7F7","accent":"#FFFFFF","darkText":"#071529","mutedText":"#5F7478"}',
  typography_json = '{"headingStyle":"bold geometric sans-serif with heavy display weight for hero words","bodyStyle":"clean modern sans-serif with generous spacing and high clarity","fontMood":"premium, clinical, confident, celebratory, polished social poster"}',
  visual_style_json = '{"mood":"premium dental clinic, clean white space, teal clinical luxury","layout":"bold hierarchy, large hero typography, curved photo masks, fine divider lines, dental sparkle accents","photoStyle":"bright clinic photography, teal-accented interiors, clean equipment, soft daylight, polished but real","avoid":["crowded flyer look","generic hospital emergency look","random stock dental icons","discount-heavy offer poster styling","too many colors outside teal, navy, white, and soft aqua","cartoon teeth unless specifically requested"]}',
  default_poster_rules_json = '["Use deep teal as the main brand color and deep navy for high-impact text","Keep the background mostly white or very pale aqua","Use bold oversized typography for the main message","Use refined dental sparkle accents and thin divider lines sparingly","Use rounded or curved image masks inspired by the reference posters","Use clinic name and phone number exactly","Keep text readable on mobile","Prefer 9:16 Instagram story aspect ratio unless otherwise specified"]',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE business_slug = 'dr-poojas-smile-craft';
