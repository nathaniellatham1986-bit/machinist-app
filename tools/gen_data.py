# Generates drill/turn/tap JSON from values transcribed from the cited sources. No interpolation.
import json, os
D = os.path.join(os.path.dirname(__file__), '..', 'data')
B5 = [[.375,.5],[.515625,.6875],[.703125,.9375],[.96875,1.375],[1.40625,1.875]]
ALLIED = dict(manufacturer="Allied Machine & Engineering", catalog="T-A Drilling Systems catalog A30-TAS (Imperial)", edition="A30-TAS (PDF copy on box)", url="https://www.alliedmachine.com/")
def rows(table, coats, bands, page, cool=None):
    out = []
    for mat, iso, hb, sfms, iprs in table:
        for c, s in zip(coats, sfms):
            ck = cool and cool.get(mat)
            out.append(dict(label=f"{mat} {hb} BHN · {c}", iso=iso, coolant=ck and "through-tool",
                sfm=dict(value=s, unit="ft/min"),
                feed=dict(kind="ipr", unit="in", bands=[b+[v] for b, v in zip(bands, iprs)]),
                status="verified", source=dict(ALLIED, page=page, **({"notes": ck} if ck else {}))))
    return out
LC, AS, HS, SS, FM = "Low-carbon 1010/1020 (mild)", "Alloy 4140/5140/8640", "High-strength 4340/300M", "Stainless 300 series (304/316/17-4PH)", "Free-machining steel 1118/1215/12L14"
ta_carb = [
 (FM,"P","100-150",[320,420,375],[.008,.012,.015,.018,.021]),(FM,"P","150-200",[280,360,325],[.007,.011,.014,.016,.019]),(FM,"P","200-250",[260,340,295],[.006,.010,.013,.015,.017]),
 (LC,"P","85-125",[300,390,360],[.008,.010,.013,.017,.019]),(LC,"P","125-175",[260,340,295],[.007,.010,.013,.016,.018]),(LC,"P","175-225",[240,310,270],[.006,.009,.012,.015,.017]),(LC,"P","225-275",[210,270,245],[.005,.009,.012,.015,.017]),
 (AS,"P","125-175",[250,325,285],[.007,.010,.013,.016,.018]),(AS,"P","175-225",[230,300,260],[.006,.009,.012,.015,.017]),(AS,"P","225-275",[210,270,235],[.006,.009,.012,.015,.017]),(AS,"P","275-325",[200,250,225],[.005,.008,.011,.014,.016]),(AS,"P","325-375",[170,220,195],[.004,.007,.010,.013,.015]),
 (HS,"P","225-300",[160,200,180],[.006,.009,.010,.012,.015]),(HS,"P","300-350",[140,180,160],[.005,.008,.009,.011,.014]),(HS,"P","350-400",[120,160,140],[.004,.007,.008,.010,.012]),
 (SS,"M","135-185",[160,210,185],[.005,.007,.009,.010,.012]),(SS,"M","185-275",[120,160,140],[.004,.006,.008,.009,.010])]
gen2_carb = [
 (FM,"P","100-150",[480],[.008,.012,.016,.019]),(FM,"P","150-200",[415],[.007,.011,.015,.017]),(FM,"P","200-250",[390],[.006,.010,.014,.016]),
 (LC,"P","85-125",[450],[.008,.010,.014,.018]),(LC,"P","125-175",[390],[.007,.010,.014,.017]),(LC,"P","175-225",[355],[.006,.009,.013,.016]),(LC,"P","225-275",[310],[.005,.009,.013,.016]),
 (AS,"P","125-175",[375],[.007,.010,.014,.017]),(AS,"P","175-225",[345],[.006,.009,.013,.016]),(AS,"P","225-275",[310],[.006,.009,.013,.016]),(AS,"P","275-325",[285],[.005,.008,.012,.015]),(AS,"P","325-375",[255],[.004,.007,.011,.014]),
 (HS,"P","225-300",[230],[.006,.009,.011,.013]),(HS,"P","300-350",[205],[.005,.008,.010,.012]),(HS,"P","350-400",[185],[.004,.007,.009,.011]),
 (SS,"M","135-185",[240],[.006,.007,.009,.012]),(SS,"M","185-275",[180],[.005,.006,.008,.009])]
gen2_hss = [
 (FM,"P","100-150",[200,325],[.008,.012]),(FM,"P","150-200",[180,300],[.007,.011]),(FM,"P","200-250",[160,280],[.006,.010]),
 (LC,"P","85-125",[170,290],[.008,.010]),(LC,"P","125-175",[160,275],[.007,.010]),(LC,"P","175-225",[150,260],[.006,.009]),(LC,"P","225-275",[140,240],[.005,.009]),
 (AS,"P","125-175",[150,240],[.007,.010]),(AS,"P","175-225",[140,225],[.006,.009]),(AS,"P","225-275",[130,210],[.006,.009]),(AS,"P","275-325",[120,195],[.005,.008]),(AS,"P","325-375",[110,180],[.004,.007]),
 (HS,"P","225-300",[80,125],[.006,.009]),(HS,"P","300-350",[60,100],[.005,.008]),(HS,"P","350-400",[50,80],[.004,.007]),
 (SS,"M","135-185",[75,110],[.003,.007]),(SS,"M","185-275",[60,100],[.003,.006])]
ta_hss = [
 (FM,"P","100-150",[200,280,260],[.007,.010]),
 (LC,"P","85-125",[170,250,220],[.006,.009]),(LC,"P","125-175",[160,240,210],[.006,.009]),(LC,"P","175-225",[150,225,195],[.005,.008]),(LC,"P","225-275",[140,210,180],[.005,.008]),
 (AS,"P","125-175",[150,210,195],[.006,.008]),(AS,"P","175-225",[140,195,180],[.005,.008]),(AS,"P","225-275",[130,180,170],[.005,.007]),(AS,"P","275-325",[120,170,155],[.004,.006]),(AS,"P","325-375",[110,155,145],[.003,.006]),
 (HS,"P","225-300",[80,110,100],[.005,.007]),(HS,"P","300-350",[60,85,80],[.004,.007]),(HS,"P","350-400",[50,70,65],[.003,.006]),
 (SS,"M","135-185",[75,105,95],[.007,.007]),(SS,"M","185-275",[60,90,80],[.006,.006])]
BN = ["3/8-1/2","33/64-11/16","23/32-1","1-1-3/8","1-13/32-1-7/8"]
def cc(chart, page, d):
    return {m: f"Allied {chart} coolant chart (A30 p.{page}), through-tool, based on water- and oil-based coolants: " + "; ".join(f'{b}\" {p} psi / {g} gpm' for b,(p,g) in zip(BN,v)) for m, v in d.items()}
COOL_C = cc("carbide", 127, {"Free-machining steel 1118/1215/12L14":[(195,2.6),(140,3.3),(160,5.5),(140,9),(155,18)], "Low-carbon 1010/1020 (mild)":[(180,2.5),(105,2.9),(105,4.4),(110,8),(115,15)], "Alloy 4140/5140/8640":[(165,2.4),(85,2.6),(100,4.3),(75,6),(70,12)], "High-strength 4340/300M":[(175,2.4),(115,2.3),(105,3.2),(75,5),(70,8)], "Stainless 300 series (304/316/17-4PH)":[(329,3),(239,4),(260,7),(250,12),(190,20)]})
COOL_H = cc("HSS", 126, {"Free-machining steel 1118/1215/12L14":[("175-185","2.5-2.6"),("100-120","2.8-3.0")], "Low-carbon 1010/1020 (mild)":[("165-170","2.4-2.5"),("75-90","2.4-2.6")], "Alloy 4140/5140/8640":[("160-165","2.3-2.4"),("65-75","2.2-2.4")], "High-strength 4340/300M":[("150-155","2.3-2.4"),("55-60","2.1-2.2")], "Stainless 300 series (304/316/17-4PH)":[(171,3),(86,3)]})
CN0 = "303: Allied's stainless row reads 'Stainless Steel 300 Series (304, 316, 17-4PH, etc.)'; 303 is not named, so it is not mapped."
CN = "Allied tables say to refer to the coolant charts (catalog pp.126-127) to run at these values; coolant condition not transcribed, so coolant = not stated. 303 is not listed by Allied; it is not mapped."
drill = dict(brand="Allied", tools=[
 dict(mode="drill", brand="Allied", series="T-A carbide insert (e.g. 1C21T-0030 = series 1, C2 carbide, TiN, 15/16\")", conditions=rows(ta_carb,["TiN","TiAlN","TiCN"],B5,"T-A Recommended Drilling Data, Carbide Inserts (Imperial)",COOL_C), notes=CN0+" Allied lists C5 grade for ISO P rows and C2 for ISO M; 1C21T is C2."),
 dict(mode="drill", brand="Allied", series="GEN2 T-A carbide AM300 (4C21P / 4C11P)", conditions=rows(gen2_carb,["AM300"],B5[:4],"GEN2 T-A Recommended Drilling Data, Carbide Inserts (Imperial)"), notes=CN+" GEN2 coolant charts not transcribed."),
 dict(mode="drill", brand="Allied", series="GEN2 T-A HSS / super cobalt (TiN or AM200)", conditions=rows(gen2_hss,["TiN","AM200"],B5[:2],"GEN2 T-A Recommended Drilling Data, HSS Inserts (Imperial)"), notes=CN+" Only 3/8\"-11/16\" feed columns transcribed."),
 dict(mode="drill", brand="Allied", series="T-A HSS insert (TiN/TiAlN/TiCN)", conditions=rows(ta_hss,["TiN","TiAlN","TiCN"],B5[:2],"T-A Recommended Drilling Data, HSS Inserts (Imperial), A30:116",COOL_H), notes=CN0+" Only 3/8\"-11/16\" feed columns transcribed."),
])
ISC = dict(manufacturer="Iscar", catalog="ISCAR Turning Catalog 42-2022, p.165 (VNMG-NF)", edition="2022 (distributor mirror cata.supratool.com.mx)", url="https://cata.supratool.com.mx/ISCAR3/files/basic-html/page167.html")
def vnmg(ins, ap, f):
    return dict(label=f"{ins} (any ISO; feed/ap only)", iso="*", coolant=None, sfm=None,
        feed=dict(kind="ipr", unit="mm", range=dict(min=f[0], max=f[1])), ap=dict(min=ap[0], max=ap[1], unit="mm"), status="verified", source=ISC)
SUP = "https://cata.supratool.com.mx/ISCAR3/files/basic-html/page{}.html"
ISV = dict(manufacturer="Iscar", catalog="ISCAR Turning Catalog 42-2022, p.246 ISO turning cutting speed table", edition="42-2022 (distributor mirror cata.supratool.com.mx)", url=SUP.format(248), page="246")
ISG = dict(manufacturer="Iscar", catalog="ISCAR Turning Catalog 42-2022, pp.432-433 groove-turn cutting speed table", edition="42-2022 (distributor mirror cata.supratool.com.mx)", url=SUP.format(434), page="432-433")
IST = dict(manufacturer="Iscar", catalog="ISCAR Threading catalog 42-2022, Machining Data for Threading (user guide)", edition="42-2022 pp.635-848 (PDF hosted by werkzeugservice.at)", url="https://www.werkzeugservice.at/uploads/downloads/ISCAR_Gewindewerkzeuge%20und%20Eins%C3%A4tze-nicht%20rotierende%20Werkezughalter-42_2022-p635-848_2022.pdf", page="710-711")
GN = {1:"Grp 1 Non-alloy <0.25%C (mild steel)",6:"Grp 6 Low alloy annealed (4140/4340)",7:"Grp 7 Low alloy Q&T 275HB (4140/4340)",8:"Grp 8 Low alloy Q&T 300HB (4140/4340)",9:"Grp 9 Low alloy Q&T 350HB (4140/4340)",14:"Grp 14 Austenitic stainless"}
def vc(src, tag, d):
    return [dict(label=f"{GN[g]} · {tag}", iso="M" if g==14 else "P", coolant=None, sfm=dict(min=a, max=b, unit="m/min"), status="verified", source=src) for g,(a,b) in d.items()]
LBL = dict(kind="label", manufacturer="Iscar", catalog="Iscar box label, photographed by user", edition="Oct 2026", url=None, notes="From the manufacturer's printed box label. The label does not name the material unless shown.")
SEI = dict(manufacturer="Sumitomo Electric", catalog="SUMIBORON BNC8115/BNS8125 flyer E-163, Recommended Cutting Conditions (Turning), Hardened Steel", edition="E-163", url="https://api.sumitomotool.com/media/roweb/publication/files/e/-/e-163_bnc8115-bns8125.pdf")
turn = dict(brand="turning", tools=[
 dict(mode="turn", brand="Iscar", series="VNMG-NF IC807", conditions=[vnmg("VNMG 160404-NF",(0.7,2.5),(0.07,0.24)),vnmg("VNMG 160408-NF",(1.0,3.0),(0.08,0.25)),vnmg("VNMG 12T304-NF",(0.7,2.0),(0.07,0.24)),vnmg("VNMG 12T308-NF",(1.0,3.0),(0.08,0.24))]+[dict(label="VNMG 12T308-NF (2.5-2-NF) ISO M · box label", iso="M", coolant=None, sfm=dict(min=200, max=300, unit="m/min"), feed=dict(kind="ipr", unit="mm", range=dict(min=0.08, max=0.24)), ap=dict(min=1.0, max=3.0, unit="mm"), status="verified", source=dict(LBL, notes="Box label: Vc 200-300 m/min (660-990 SFM), f 0.080-0.240 mm/rev, ap 1.00-3.00 mm, ISO M. Catalog p.246 gives 100-200 m/min for group 14; the two sources differ, so both are shown."))]+vc(ISV,"IC807 Vc",{1:(140,230),6:(100,180),7:(95,170),8:(85,150),9:(70,130),14:(100,200)}),
      notes="Insert rows give ap/feed (p.165). Vc rows are the IC807/IC907 column of the p.246 grade table (no feed in that table). Iscar gives a range only, so the default is the MIDPOINT. Iscar group 14 is 'austenitic stainless' (no grade named), so these rows attach to both 303 and 304."),
 dict(mode="turn", brand="Iscar", series="VNMG F3M IC806", conditions=[], notes="No manufacturer data for P/M: the p.246 turning table lists IC806 only for ISO S (heat-resistant alloys). (In the groove-turn table pp.432-433, IC806 is 110-205 m/min for group 14, but that is grooving, not F3M turning.)"),
 dict(mode="turn", brand="Iscar", series="CNMG (chipformer/grade TBD)", conditions=[], notes="Not yet sourced; need exact chipformer and grade."),
 dict(mode="turn", brand="Iscar", series="PENTA grooving IC1008", conditions=[dict(label="PENTA 17N120P010RS IC1008 · box label (material not stated)", iso="*", coolant=None, sfm=dict(min=60, max=150, unit="m/min"), feed=dict(kind="ipr", unit="mm", range=dict(min=0.02, max=0.05)), status="verified", source=dict(LBL, notes="Box label: Vc 60-150 m/min (200-500 SFM), f 0.02-0.05 mm/rev."))], notes="Box label data only. Catalog: no manufacturer data for Vc: IC1008 is not in the groove-turn speed table (pp.432-433), and the PENTA page gives only ap/feed."),
 dict(mode="turn", brand="Iscar", series="Tang-Grip TGSU (groove-turn)", conditions=vc(ISG,"IC807",{1:(160,240),6:(125,195),7:(105,170),8:(105,160),9:(90,150),14:(105,195)})+vc(ISG,"IC808",{1:(145,220),6:(115,180),7:(95,155),8:(95,145),9:(85,135),14:(95,180)})+vc(ISG,"IC908",{1:(140,210),6:(110,170),7:(90,150),8:(90,140),9:(80,130),14:(90,170)})+vc(ISG,"IC830",{1:(105,155),6:(80,125),7:(65,110),8:(65,105),9:(60,95),14:(65,125)}), notes="Groove-turn Vc by grade (choose your insert grade). Feed is not in this table. The default is the MIDPOINT of the range."),
 dict(mode="turn", brand="Iscar", series="Threading IC908", conditions=vc(IST,"IC908 threading",{1:(115,190),6:(100,180),7:(75,140),8:(70,135),9:(70,135),14:(90,140)}), notes="Machining Data for Threading table. Group 1 is listed at 125HB, group 6 at 200HB, group 14 (austenitic/duplex) at 180HB. Infeed and passes are not loaded. The default is the MIDPOINT."),
 dict(mode="turn", brand="Mitsubishi", series="BC8110 CBN (Mitsubishi grade; Sumitomo's own comparison chart lists BC8110 under Mitsubishi, Sumitomo equivalents BNC2010/BN1000)", conditions=[dict(label="Hardened steel, external continuous cutting", iso="H", coolant="dry or wet (stated)", sfm=None,
      feed=dict(kind="ipr", unit="mm", range=dict(max=0.20)), ap=dict(max=0.35, unit="mm"), status="verified",
      source=dict(manufacturer="Mitsubishi Materials", catalog="Tool News B215G BC8100/MB8100 series, Recommended Cutting Conditions", edition="2018.12 update (2017.9.E)", url="https://www.mmc-carbide.com/download_file/f7122c42-eec6-43d1-a937-0b7bc5ccfb12/2021",
      notes="States f < 0.20 mm/rev, ap < 0.35 mm, cutting mode Dry/Wet. Vc is shown only as a bar chart with no numbers, so: No manufacturer data for Vc. 250 m/min appears only as a test example."))],
      notes="Only an upper limit is published for feed. With no min, no default is invented. Enter YOUR VALUE."),
 dict(mode="turn", brand="Sumitomo", series="SUMIBORON BNC8115 CBN (hardened steel)", conditions=[dict(label="Hardened steel", iso="H", coolant="flood",
      sfm=dict(min=50, start=100, max=150, unit="m/min"), feed=dict(kind="ipr", unit="mm", range=dict(min=0.10, start=0.25, max=0.40)), ap=dict(max=3.0, unit="mm"),
      status="verified", source=dict(SEI, notes="Source says 'Coolant: wet'; recorded as flood. Values are Min-Optimum-Max; Optimum used as start."))]),
])
OSG = dict(manufacturer="OSG", catalog="Taps: Recommended Tapping Conditions - HY-PRO and HY-PRO DIN, Machining Centers", edition="OSG tech page (syndigo-hosted PDF)", url="https://content.syndigo.com/asset/49270877-d96b-4daa-866c-613cf6d1e7c5/original.pdf", notes="Rigid setup required to run these speeds. Coolant-through column (250 psi) not loaded.")
GUH = dict(manufacturer="Guhring", catalog="Speed & feed sheet 3909 (Blue Ring cut taps)", edition="guhring.com/media/speedfeed/3909.pdf", url="https://guhring.com/media/speedfeed/3909.pdf")
def osg(m, iso, r): return dict(label=m, iso=iso, coolant=None, sfm=dict(min=r[0], max=r[1], unit="ft/min"), status="verified", source=OSG)
gr = []
for m, rr in [("Stainless, sulphured (e.g. 303) <180 HB", [(25,35),(40,55),(30,55),(35,70)]), ("Stainless, austenitic (304) <250 HB", [(20,30),(30,40),(30,50),(35,60)])]:
    for sub, r in zip(["HSS-E bright","HSS-E hard coated","HSS-E-PM bright","HSS-E-PM hard coated"], rr):
        gr.append(dict(label=f"{m} · {sub}", iso="M", coolant=None, sfm=dict(min=r[0], max=r[1], unit="ft/min"), status="verified", source=GUH))
EMU = dict(manufacturer="Emuge", catalog="EMUGE USA Catalog 510, Taps product finder and cutting data, Tapered Taps (NPT pp.102-103)", edition="Catalog 510 (PDF on tecnoutensilisrl.it, PDF p.19)", url="https://www.tecnoutensilisrl.it/wp-content/uploads/2017/04/Emuge-510-Catalog_0.pdf", page="fold-out product finder, PDF p.19")
tap = dict(brand="tapping", tools=[
 dict(mode="tap", brand="OSG", series="HY-PRO / HY-PRO DIN", conditions=[osg("Low carbon steel A36/1018/12L14","P",(50,90)),osg("Alloy steel 4140/4340/8620","P",(40,80)),osg("Stainless 303/304/316/400","M",(40,80))]),
 dict(mode="tap", brand="Guhring", series="3909", conditions=gr, notes="Sheet lists HSS-E and HSS-E-PM, bright and hard-coated columns; pick the one matching your tap. Only stainless rows are on this sheet."),
 dict(mode="tap", brand="Emuge", series="Rekord 2-KEG R15-VA NPT spiral flute 15° (CW483000 / CW483100 TIN)", conditions=[dict(label=l, iso=i, coolant="emulsion or oil (stated)", sfm=dict(min=a, max=b, unit="ft/min"), status="verified", source=EMU) for l,i,a,b in [("P1.1 1010/1018/1020/12L14 <=180 BHN","P",7,26),("P2.1 A36/1030-1095/4140/4340/8620 <=235 BHN","P",7,20),("M2.1 Austenitic 303/304/316 <=280 BHN","M",3,26)]],
      notes="Emuge marks these as standard values to be adjusted to your work conditions. Straight-flute KEG-STEEL is in the same table but not loaded."),
])
shop = dict(brand="shop-proven", tools=[dict(mode="turn", brand="Shop-proven (not manufacturer)", series="4 mm carbide parting tool", conditions=[dict(label="304 SS · Mazak QT 350 MY · good finish", iso="M", coolant=None, sfm=dict(value=180, unit="ft/min"), feed=dict(kind="ipr", unit="in", range=dict(value=0.0018)), status="shop-proven", source=dict(kind="shop", manufacturer="Shop record", catalog="Run on Mazak QT 350 MY, 304 stainless, good finish", edition="Oct 15 2026", url=None))], notes="A setup that worked at one shop. This is not manufacturer data.")])
import re
# Material mapping: only what the source names. (label prefix -> (materials, source wording))
MATMAP = [("Stainless 300 series (304/316/17-4PH)", ["ss304","ss17-4ph"], "Stainless Steel 300 Series (304, 316, 17-4PH, etc.)"),
  ("Grp 14 Austenitic stainless", ["ss303","ss304"], "Iscar group 14: austenitic stainless"),
  ("M2.1 Austenitic 303/304/316", ["ss303","ss304"], "M2.1 austenitic 303/304/316"),
  ("Stainless, sulphured (e.g. 303)", ["ss303"], "Stainless, sulphured (e.g. 303)"),
  ("Stainless, austenitic (304)", ["ss304"], "Stainless, austenitic (304)"),
  ("Stainless 303/304/316/400", ["ss303","ss304","ss400"], "Stainless 303/304/316/400"),
  ("304 SS", ["ss304"], "304 stainless (shop record)"),
  ("Low-carbon 1010/1020 (mild)", ["p-mild"], "Low-carbon 1010/1020 (mild)"), ("Alloy 4140/5140/8640", ["p-alloy"], "Alloy 4140/5140/8640"),
  ("Low carbon steel A36/1018/12L14", ["p-mild"], "Low carbon steel A36/1018/12L14"), ("Alloy steel 4140/4340/8620", ["p-alloy"], "Alloy steel 4140/4340/8620"),
  ("P1.1 1010/1018/1020/12L14", ["p-mild"], "P1.1 1010/1018/1020/12L14"), ("P2.1 A36/1030-1095/4140/4340/8620", ["p-mild","p-alloy"], "P2.1 A36/1030-1095/4140/4340/8620"),
  ("Grp 1 Non-alloy", ["p-mild"], "Iscar group 1: non-alloy steel <0.25% C"), ("Grp 6 Low alloy", ["p-alloy"], "Iscar group 6: low alloy, annealed"),
  ("Grp 7 Low alloy", ["p-alloy"], "Iscar group 7: low alloy, hardened & tempered"), ("Grp 8 Low alloy", ["p-alloy"], "Iscar group 8: low alloy, hardened & tempered"),
  ("Grp 9 Low alloy", ["p-alloy"], "Iscar group 9: low alloy, hardened & tempered")]
for o in [drill, turn, tap, shop]:
    for t in o["tools"]:
        for c in t["conditions"]:
            for pre, ms, g in MATMAP:
                if c["label"].startswith(pre): c["materials"], c["sourceGroup"] = ms, g
slug = lambda x: re.sub(r"[^a-z0-9]+", "-", x.lower()).strip("-")
def kind(src):
    src.setdefault("kind", "catalog")
for o in [drill, turn, tap]:
    for t in o["tools"]:
        for c in t["conditions"]: kind(c["source"])
groups = {}
for o in [drill, turn, tap]:
    for t in o["tools"]: groups.setdefault((t["brand"], t["mode"]), []).append(t)
for (b, m), ts in groups.items():
    json.dump(dict(schema=1, brand=b, tools=ts), open(os.path.join(D, f"{slug(b)}-{m}.json"), "w"), indent=1)
json.dump(dict(schema=1, brand=shop["tools"][0]["brand"], tools=shop["tools"]), open(os.path.join(D, "shop.json"), "w"), indent=1)
# Tap drills: geometry. 75% drill = D - 0.01299*75*P(in) per Machinery's Handbook formula (= D - 0.974*P).
unc = [("#4-40",.112,40,"#43 (.0890)"),("#6-32",.138,32,"#35 (.1100)"),("#8-32",.164,32,"#29 (.1360)"),("#10-24",.19,24,"#25 (.1495)"),("#10-32",.19,32,"#21 (.1590)"),("1/4-20",.25,20,"#7 (.2010)"),("1/4-28",.25,28,"#3 (.2130)"),("5/16-18",.3125,18,"F (.2570)"),("5/16-24",.3125,24,"I (.2720)"),("3/8-16",.375,16,"5/16 (.3125)"),("3/8-24",.375,24,"Q (.3320)"),("7/16-14",.4375,14,"U (.3680)"),("7/16-20",.4375,20,"25/64 (.3906)"),("1/2-13",.5,13,"27/64 (.4219)"),("1/2-20",.5,20,"29/64 (.4531)"),("5/8-11",.625,11,"17/32 (.5312)"),("5/8-18",.625,18,"37/64 (.5781)"),("3/4-10",.75,10,"21/32 (.6562)"),("3/4-16",.75,16,"11/16 (.6875)"),("1-8",1.0,8,"7/8 (.8750)")]
met = [("M3x0.5",3,.5),("M4x0.7",4,.7),("M5x0.8",5,.8),("M6x1",6,1.0),("M8x1.25",8,1.25),("M10x1.5",10,1.5),("M12x1.75",12,1.75),("M16x2",16,2.0),("M20x2.5",20,2.5),("M24x3",24,3.0)]
th = [dict(name=n, d_in=d, pitch_in=round(1/t,5), drill75_in=round(d-0.974/t,4), chart=c) for n,d,t,c in unc] + \
     [dict(name=n, d_in=round(d/25.4,4), pitch_in=round(p/25.4,5), drill75_mm=round(d-0.974*p,2), drill75_in=round((d-0.974*p)/25.4,4), chart=None) for n,d,p in met]
json.dump(dict(source=dict(formula="75% tap drill = D - 0.01299 x 75 x P (Machinery's Handbook tap-drill formula; geometry, not a speed)", chart="Inch drill picks: Drill-HQ 'Tap and Drill Chart (Recommended tap drill to use for 75% depth of thread)'", chart_url="https://www.drill-hq.com/wp-content/uploads/2022/04/TapandDrillChart.pdf"), threads=th), open(os.path.join(D,"threads.json"),"w"), indent=1)
