# Fonts: licence check before the repository can be public

Checked from the licence text inside each font file (name table). Files marked "not read" are WOFF2 files whose licence text could not be opened here; they must be checked by hand.

| File | What the file says | Public repo? |
|---|---|---|
| latin/Poppins-Bold.ttf | SIL Open Font License 1.1 | OK |
| latin/DejaVuSans-Bold.ttf, DejaVuSerif-Bold.ttf, server/DejaVuSans-Bold.ttf | Bitstream Vera / DejaVu licence (free to redistribute) | OK |
| urdu/Jauhar.woff | "This font cannot be distributed, copied, modified" (Pakistan Data Management Services) | **REMOVED from the repo (also removed from the font list)** |
| server/PDAslam.ttf | "Axis SoftMedia Pvt. Ltd., 2008. All Rights Reserved", no licence text | **Unclear: remove or get permission** |
| urdu/Fajer-Noori-Nastalique.woff | Licence agreement (M. G. Abbas Malik); terms must be read | Check |
| urdu/Nafees-Nastaleeq.woff | CRULP licence agreement; terms must be read | Check |
| jameel-noori-nastaleeq.woff | "This Font Is Free Of Charge For Urdu Lovers" (no redistribution terms) | Unclear |
| urdu/Nafees-Web-Naskh.woff | no licence text in the file | Check |
| urdu/Aslam, AlQalam (3), AlviLahori, Bukhari, DehalviKhushKhat, Hussaini, JameelNooriNastaleeqKasheeda, Khat-e-Musarat, Laiq, Mehr-Nastaliq-Web, PakNastaleeq, emad-nastaleeq, jameel-khushkhati (.woff2) | not read | Check |

Note: the site already serves these files to every visitor, so a public repo adds redistribution of the source files, not a new kind of exposure.
Before going public: remove the fonts marked NO/Unclear from git (keep them in Cloudflare/R2 or replace with a freely licensed Nastaliq such as Noto Nastaliq Urdu), and check the rest.
