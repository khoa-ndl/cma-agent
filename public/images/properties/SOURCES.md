# Property photo sources

All photos are genuine photographs from Wikimedia Commons, used under
licenses that permit commercial reuse (CC0, CC BY, or CC BY-SA). None are
AI-generated. None are tied to any real address used elsewhere in this
app -- the comp-sale dataset is entirely synthetic/fictional, and these
photos are generic stock-style exteriors only, picked for each
`propertySubType` bucket (single-family house, condominium/apartment
building, townhouse/rowhouse), and specifically screened to avoid legible
real-world house numbers, street-name signs, or business names/phone
numbers that could be mistaken for part of the (fictional) comp data.

Each entry: local filename -- Commons file page -- license -- photographer/uploader.

## single-family (SingleFamilyResidence)

- `single-family-1.jpg` -- https://commons.wikimedia.org/wiki/File:Maple_Valley,_WA_-_Olson_House_01.jpg -- CC BY-SA 3.0 -- Joe Mabel
- `single-family-2.jpg` -- https://commons.wikimedia.org/wiki/File:Anacortes_-_1119_7th_St_01.jpg -- CC BY-SA 3.0 -- Joe Mabel
- `single-family-3.jpg` -- https://commons.wikimedia.org/wiki/File:House_on_SW_Maury_Park_Road_01.jpg -- CC BY-SA 3.0 -- Joe Mabel
- `single-family-4.jpg` -- https://commons.wikimedia.org/wiki/File:House_in_Crescent_Bar_WA.jpg -- CC BY 2.0 -- Todd Petit (Flickr)
- `single-family-5.jpg` -- https://commons.wikimedia.org/wiki/File:Edmonds_WA_-_320_Sunset_Ave_N.jpg -- CC BY-SA 3.0 -- Joe Mabel
- `single-family-6.jpg` -- https://commons.wikimedia.org/wiki/File:Carbonado,_WA_-_house_05.jpg -- CC BY-SA 3.0 -- Joe Mabel

## condo (Condominium)

- `condo-1.jpg` -- https://commons.wikimedia.org/wiki/File:A_Condominium_Building_in_Tacoma.jpg -- CC BY-SA 4.0 -- Jacobrosere
- `condo-2.jpg` -- https://commons.wikimedia.org/wiki/File:Apartments_on_Silver_Lake,_Everett,_WA.jpg -- CC BY-SA 4.0 -- SounderBruce
- `condo-3.jpg` -- https://commons.wikimedia.org/wiki/File:Condo_building_at_310_2nd_St_S,_Jacksonville_Beach,_Florida,_2019-03-07-4412.jpg -- CC BY-SA 4.0 -- Tim Kiser
- `condo-4.jpg` -- https://commons.wikimedia.org/wiki/File:Exterior_view_of_northwest_corner_of_Summit_House_East..jpg -- CC BY-SA 4.0 -- Mikepascoe
- `condo-5.jpg` -- https://commons.wikimedia.org/wiki/File:Apartments_3246.jpg -- CC BY-SA 4.0 -- Chris Light
- `condo-6.jpg` -- https://commons.wikimedia.org/wiki/File:1871_Stone_Gate_Circle_-_Davenport.jpg -- CC BY-SA 4.0 -- Farragutful

## townhouse (Townhouse)

- `townhouse-1.jpg` -- https://commons.wikimedia.org/wiki/File:Bolton_Hill,_rowhomes_(20982448093).jpg -- CC BY-SA 2.0 -- Preservation Maryland (Flickr, imported via flickr2commons)
- `townhouse-2.jpg` -- https://commons.wikimedia.org/wiki/File:2500_block_of_Guilford_Avenue_(east_side),_Baltimore,_MD_21218_(34947306644).jpg -- CC0 -- Baltimore Heritage
- `townhouse-3.jpg` -- https://commons.wikimedia.org/wiki/File:2600_block_of_Maryland_Avenue,_Baltimore,_MD_21218_(35850713201).jpg -- CC0 -- Baltimore Heritage
- `townhouse-4.jpg` -- https://commons.wikimedia.org/wiki/File:201-213_Delancey_Street_Society_Hill.jpg -- CC BY-SA 4.0 -- Beyond My Ken
- `townhouse-5.jpg` -- https://commons.wikimedia.org/wiki/File:224-228_West_Washington_Square_from_north.jpg -- CC BY-SA 4.0 -- Beyond My Ken
- `townhouse-6.jpg` -- https://commons.wikimedia.org/wiki/File:1523_%26_1525_Cherry_Street.jpg -- CC BY-SA 4.0 -- Beyond My Ken

## Notes

- Each file's license was confirmed via the Wikimedia Commons API
  (`action=query&prop=imageinfo&iiprop=extmetadata`) against the live file
  page before download -- all permit commercial reuse with no
  no-derivatives or non-commercial restriction.
- Downloaded as the ~1280px-wide web-display rendition Wikimedia serves
  (`iiurlwidth=1024` thumbnail, which Wikimedia rounds up to 1280px), not
  full original resolution -- plenty for the report's photo tiles, far
  smaller to bundle.
- CC BY-SA and CC BY terms require attribution if these images are ever
  redistributed/republished outside this app (this file serves as that
  attribution record); CC0 files carry no such requirement.

### Revision history

- **First pass:** an initial pick for `townhouse-1` (a Lafayette Avenue block
  of boarded-up, graffitied vacant rowhouses) and `condo-6` (a Houston
  high-rise with a bystander's head in frame) were swapped out before the
  first commit for files that actually look like marketable properties.
- **Second pass (post-review):** a follow-up review caught a systemic gap in
  the first pass's content screening -- it checked for blight/clutter but not
  for legible real-world address numbers or street-name signs, several of
  which had slipped through (e.g. house numbers stenciled above doors, street
  name signs on utility poles), plus one file (`condo-2`, the original
  `Condos_in_Mountain_View.jpg`) showing a real leasing company's name and
  phone number on a sign in frame. 11 files were re-sourced
  (`single-family-1/3/4/6`, `condo-2/4/5`, `townhouse-1/4/5/6`) with the same
  license diligence, this time also screening each candidate for legible
  numbers/signage/business names and property condition *before* picking it.
  `townhouse-4/5/6`'s replacements moved off the Baltimore Heritage block-survey
  photo set (which consistently frames street-name signs, by the nature of
  what that project documents) to Philadelphia historic-district rowhouse
  photos by a different photographer, to avoid the same pattern recurring.
