# Property photo sources

All photos are genuine photographs from Wikimedia Commons, used under
licenses that permit commercial reuse (CC0, CC BY, or CC BY-SA). None are
AI-generated. None are tied to any real address used elsewhere in this
app -- the comp-sale dataset is entirely synthetic/fictional, and these
photos are generic stock-style exteriors only, picked for each
`propertySubType` bucket (single-family house, condominium/apartment
building, townhouse/rowhouse).

Each entry: local filename -- Commons file page -- license -- photographer/uploader.

## single-family (SingleFamilyResidence)

- `single-family-1.jpg` -- https://commons.wikimedia.org/wiki/File:Anacortes_-_1109_7th_St_01.jpg -- CC BY-SA 3.0 -- Joe Mabel
- `single-family-2.jpg` -- https://commons.wikimedia.org/wiki/File:Anacortes_-_1119_7th_St_01.jpg -- CC BY-SA 3.0 -- Joe Mabel
- `single-family-3.jpg` -- https://commons.wikimedia.org/wiki/File:Edmonds_WA_-_228_Sunset_Ave_N.jpg -- CC BY-SA 3.0 -- Joe Mabel
- `single-family-4.jpg` -- https://commons.wikimedia.org/wiki/File:Edmonds_WA_-_310_Sunset_Ave_N.jpg -- CC BY-SA 3.0 -- Joe Mabel
- `single-family-5.jpg` -- https://commons.wikimedia.org/wiki/File:Edmonds_WA_-_320_Sunset_Ave_N.jpg -- CC BY-SA 3.0 -- Joe Mabel
- `single-family-6.jpg` -- https://commons.wikimedia.org/wiki/File:Enumclaw,_WA_-_1529_Griffin.jpg -- CC BY-SA 3.0 -- Joe Mabel

## condo (Condominium)

- `condo-1.jpg` -- https://commons.wikimedia.org/wiki/File:A_Condominium_Building_in_Tacoma.jpg -- CC BY-SA 4.0 -- Jacobrosere
- `condo-2.jpg` -- https://commons.wikimedia.org/wiki/File:Condos_in_Mountain_View.jpg -- CC BY-SA 4.0 -- CarmenEsparzaAmoux
- `condo-3.jpg` -- https://commons.wikimedia.org/wiki/File:Condo_building_at_310_2nd_St_S,_Jacksonville_Beach,_Florida,_2019-03-07-4412.jpg -- CC BY-SA 4.0 -- Tim Kiser
- `condo-4.jpg` -- https://commons.wikimedia.org/wiki/File:Casa_Bella_Condominiums,_Bainbridge,_Georgia.jpg -- CC BY-SA 4.0 -- The Bushranger
- `condo-5.jpg` -- https://commons.wikimedia.org/wiki/File:Everett_-_2031_Rucker_01.jpg -- CC BY-SA 3.0 -- Joe Mabel
- `condo-6.jpg` -- https://commons.wikimedia.org/wiki/File:1871_Stone_Gate_Circle_-_Davenport.jpg -- CC BY-SA 4.0 -- Farragutful

## townhouse (Townhouse)

- `townhouse-1.jpg` -- https://commons.wikimedia.org/wiki/File:Bolton_Hill,_rowhome_(20980762874).jpg -- CC BY-SA 2.0 -- Preservation Maryland (Flickr, imported via flickr2commons)
- `townhouse-2.jpg` -- https://commons.wikimedia.org/wiki/File:2500_block_of_Guilford_Avenue_(east_side),_Baltimore,_MD_21218_(34947306644).jpg -- CC0 -- Baltimore Heritage
- `townhouse-3.jpg` -- https://commons.wikimedia.org/wiki/File:2600_block_of_Maryland_Avenue,_Baltimore,_MD_21218_(35850713201).jpg -- CC0 -- Baltimore Heritage
- `townhouse-4.jpg` -- https://commons.wikimedia.org/wiki/File:2620-2628_Guilford_Avenue,_Baltimore,_MD_21218_(35941565316).jpg -- CC0 -- Baltimore Heritage
- `townhouse-5.jpg` -- https://commons.wikimedia.org/wiki/File:300_block_of_E._26th_Street_(north_side),_Baltimore,_MD_21218_(34711856524).jpg -- CC0 -- Baltimore Heritage
- `townhouse-6.jpg` -- https://commons.wikimedia.org/wiki/File:2500_Madison_Avenue,_Baltimore,_MD_21217_(32514577483).jpg -- CC0 -- Baltimore Heritage

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
- An earlier pick for `townhouse-1` (a Lafayette Avenue block of boarded-up,
  graffitied vacant rowhouses) and `condo-6` (a Houston high-rise with a
  bystander's head in frame) were swapped out for the files listed above --
  same license tier, but the photos actually look like marketable
  properties.
