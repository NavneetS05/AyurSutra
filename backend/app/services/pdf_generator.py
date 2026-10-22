import io
import os
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.fonts import addMapping
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    HRFlowable,
    KeepTogether,
)

# ---------------------------------------------------------------------------
# Font Setup: Enable Indian Rupee (₹, U+20B9) support without tofu (■)
# ---------------------------------------------------------------------------
FONT_REGULAR = "Helvetica"
FONT_BOLD = "Helvetica-Bold"
CURRENCY_SYMBOL = "Rs. "

_candidate_fonts = [
    # Windows system fonts with full Unicode / Rupee glyph support
    ("C:/Windows/Fonts/arial.ttf", "C:/Windows/Fonts/arialbd.ttf"),
    ("C:/Windows/Fonts/calibri.ttf", "C:/Windows/Fonts/calibrib.ttf"),
    ("C:/Windows/Fonts/segoeui.ttf", "C:/Windows/Fonts/segoeuib.ttf"),
    # Linux system fonts
    ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
    ("/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf", "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"),
    ("/usr/share/fonts/truetype/freefont/FreeSans.ttf", "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf"),
]

for _reg, _bld in _candidate_fonts:
    if os.path.exists(_reg) and os.path.exists(_bld):
        try:
            _font_reg = TTFont("AyurFont", _reg)
            _font_bld = TTFont("AyurFont-Bold", _bld)
            # Verify the font file actually defines the Rupee glyph (U+20B9)
            if ord("₹") in _font_reg.face.charToGlyph and ord("₹") in _font_bld.face.charToGlyph:
                pdfmetrics.registerFont(_font_reg)
                pdfmetrics.registerFont(_font_bld)
                addMapping("AyurFont", 0, 0, "AyurFont")
                addMapping("AyurFont", 1, 0, "AyurFont-Bold")
                FONT_REGULAR = "AyurFont"
                FONT_BOLD = "AyurFont-Bold"
                CURRENCY_SYMBOL = "₹"
                break
        except Exception:
            continue

# Brand colors
PRIMARY = colors.HexColor("#2D5A27")       # Deep Ayurvedic Green
SECONDARY = colors.HexColor("#C88A2C")     # Ayurvedic Warm Amber/Gold
TEXT_DARK = colors.HexColor("#1A202C")     # Dark charcoal
TEXT_MUTED = colors.HexColor("#4A5568")    # Muted grey
BG_LIGHT = colors.HexColor("#F7FAF7")      # Very subtle sage tint
BORDER_COLOR = colors.HexColor("#CBD5E1")  # Clean slate border
SUCCESS_BG = colors.HexColor("#ECFDF5")    # Soft mint green
SUCCESS_TXT = colors.HexColor("#065F46")   # Dark green


def build_styles():
    base_styles = getSampleStyleSheet()

    styles = {
        "title": ParagraphStyle(
            "ClinicTitle",
            parent=base_styles["Heading1"],
            fontName=FONT_BOLD,
            fontSize=18,
            leading=22,
            textColor=PRIMARY,
            spaceAfter=2,
        ),
        "subtitle": ParagraphStyle(
            "DocSubtitle",
            parent=base_styles["Normal"],
            fontName=FONT_BOLD,
            fontSize=11,
            leading=14,
            textColor=SECONDARY,
            textTransform="uppercase",
            spaceAfter=6,
        ),
        "normal": ParagraphStyle(
            "CustomNormal",
            parent=base_styles["Normal"],
            fontName=FONT_REGULAR,
            fontSize=9.5,
            leading=13,
            textColor=TEXT_DARK,
        ),
        "muted": ParagraphStyle(
            "CustomMuted",
            parent=base_styles["Normal"],
            fontName=FONT_REGULAR,
            fontSize=8.5,
            leading=11,
            textColor=TEXT_MUTED,
        ),
        "bold": ParagraphStyle(
            "CustomBold",
            parent=base_styles["Normal"],
            fontName=FONT_BOLD,
            fontSize=9.5,
            leading=13,
            textColor=TEXT_DARK,
        ),
        "table_header": ParagraphStyle(
            "TableHeader",
            parent=base_styles["Normal"],
            fontName=FONT_BOLD,
            fontSize=9,
            leading=12,
            textColor=colors.white,
        ),
        "table_cell": ParagraphStyle(
            "TableCell",
            parent=base_styles["Normal"],
            fontName=FONT_REGULAR,
            fontSize=8.5,
            leading=11.5,
            textColor=TEXT_DARK,
        ),
        "table_cell_bold": ParagraphStyle(
            "TableCellBold",
            parent=base_styles["Normal"],
            fontName=FONT_BOLD,
            fontSize=8.5,
            leading=11.5,
            textColor=TEXT_DARK,
        ),
        "section_heading": ParagraphStyle(
            "SectionHeading",
            parent=base_styles["Heading3"],
            fontName=FONT_BOLD,
            fontSize=11,
            leading=15,
            textColor=PRIMARY,
            spaceBefore=10,
            spaceAfter=4,
        ),
        "badge": ParagraphStyle(
            "BadgeStyle",
            parent=base_styles["Normal"],
            fontName=FONT_BOLD,
            fontSize=10,
            leading=13,
            textColor=SUCCESS_TXT,
        ),
    }
    return styles


def generate_receipt_pdf(
    receipt_number: str,
    paid_at: datetime,
    method: str,
    amount: float,
    reference_number: str | None,
    patient_name: str,
    patient_number: str | None,
    patient_phone: str | None,
    patient_email: str | None,
    description: str,
    clinic_name: str = "AyurSutra Ayurvedic Health Center & Hospital",
) -> bytes:
    """Generates an official, printable payment receipt PDF using pure Python ReportLab."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=40,
        rightMargin=40,
        topMargin=40,
        bottomMargin=40,
    )

    styles = build_styles()
    story = []

    # Header with Clinic Branding
    header_data = [
        [
            Paragraph(f"<b>{clinic_name}</b>", styles["title"]),
            Paragraph("<b>RECEIPT VOUCHER</b>", ParagraphStyle(
                "ReceiptHeaderTag",
                parent=styles["title"],
                fontSize=14,
                leading=16,
                alignment=2,
                textColor=PRIMARY,
            )),
        ],
        [
            Paragraph("Holistic Panchakarma Therapy & Care Excellence", styles["subtitle"]),
            Paragraph(f"Receipt No: <b>{receipt_number}</b>", ParagraphStyle(
                "ReceiptNoTag",
                parent=styles["bold"],
                alignment=2,
                textColor=TEXT_MUTED,
            )),
        ],
    ]
    header_table = Table(header_data, colWidths=[330, 185])
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(header_table)
    story.append(HRFlowable(width="100%", thickness=1.5, color=PRIMARY, spaceBefore=6, spaceAfter=14))

    # Details Box (Receipt Meta & Billed Patient)
    date_str = paid_at.strftime("%d %B %Y, %I:%M %p") if paid_at else datetime.now().strftime("%d %B %Y, %I:%M %p")
    p_num = patient_number or "N/A"

    info_data = [
        [
            Paragraph("<b>BILLED TO (PATIENT):</b>", styles["subtitle"]),
            Paragraph("<b>PAYMENT TRANSACTION:</b>", styles["subtitle"]),
        ],
        [
            Paragraph(f"<b>Name:</b> {patient_name}", styles["normal"]),
            Paragraph(f"<b>Receipt Date:</b> {date_str}", styles["normal"]),
        ],
        [
            Paragraph(f"<b>Patient ID:</b> <font color='#2D5A27'><b>{p_num}</b></font>", styles["normal"]),
            Paragraph(f"<b>Payment Mode:</b> <b>{method.upper()}</b>", styles["normal"]),
        ],
        [
            Paragraph(f"<b>Phone:</b> {patient_phone or '—'}", styles["normal"]),
            Paragraph(f"<b>Status:</b> <font color='#065F46'><b>CONFIRMED & PAID</b></font>", styles["normal"]),
        ],
    ]
    if reference_number or patient_email:
        info_data.append([
            Paragraph(f"<b>Email:</b> {patient_email or '—'}", styles["normal"]),
            Paragraph(f"<b>Ref/Txn No:</b> {reference_number or '—'}", styles["normal"]),
        ])

    info_table = Table(info_data, colWidths=[255, 260])
    info_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), BG_LIGHT),
        ("BOX", (0, 0), (-1, -1), 1, BORDER_COLOR),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
    ]))
    story.append(info_table)
    story.append(Spacer(1, 16))

    # Items Breakdown Table
    items_header = [
        Paragraph("<b>Particulars / Service Description</b>", styles["table_header"]),
        Paragraph("<b>Amount (INR)</b>", ParagraphStyle(
            "AmtHdr", parent=styles["table_header"], alignment=2
        )),
    ]
    item_row = [
        Paragraph(f"<b>{description}</b><br/><font size='8' color='#718096'>Ayurvedic clinical service fee receipt</font>", styles["table_cell"]),
        Paragraph(f"<b>{CURRENCY_SYMBOL}{amount:,.2f}</b>", ParagraphStyle(
            "AmtCell", parent=styles["table_cell_bold"], alignment=2, fontSize=10
        )),
    ]
    total_row = [
        Paragraph("<b>NET AMOUNT PAID</b>", ParagraphStyle(
            "TotalLabel", parent=styles["bold"], fontSize=10, textColor=PRIMARY
        )),
        Paragraph(f"<b>{CURRENCY_SYMBOL}{amount:,.2f}</b>", ParagraphStyle(
            "TotalAmt", parent=styles["bold"], alignment=2, fontSize=12, textColor=PRIMARY
        )),
    ]

    items_table = Table([items_header, item_row, total_row], colWidths=[385, 130])
    items_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("BACKGROUND", (0, 2), (-1, 2), SUCCESS_BG),
    ]))
    story.append(items_table)
    story.append(Spacer(1, 35))

    # Signatures & Verification Area
    sig_data = [
        [
            Paragraph("<b>Patient / Payee Verification:</b>", styles["muted"]),
            Paragraph("<b>Front Desk / Authorized Signatory:</b>", styles["muted"]),
        ],
        [
            Spacer(1, 30),
            Spacer(1, 30),
        ],
        [
            Paragraph("____________________________<br/>Receiver's Signature", styles["normal"]),
            Paragraph("____________________________<br/>AyurSutra Accounts Desk", styles["normal"]),
        ],
    ]
    sig_table = Table(sig_data, colWidths=[255, 260])
    sig_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(sig_table)
    story.append(Spacer(1, 30))

    # Footer Notice
    footer_text = (
        "This is an official computer-generated receipt from AyurSutra. "
        "Ayurveda promotes harmony of body, mind, and spirit. Thank you for entrusting your care with us!"
    )
    story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER_COLOR, spaceBefore=10, spaceAfter=8))
    story.append(Paragraph(footer_text, ParagraphStyle("FooterP", parent=styles["muted"], alignment=1)))

    doc.build(story)
    return buffer.getvalue()


def generate_treatment_summary_pdf(
    data: dict,
    clinic_name: str = "AyurSutra Ayurvedic Health Center & Hospital",
) -> bytes:
    """Generates an official, printable Clinical Treatment Summary & Discharge Report PDF."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=35,
        rightMargin=35,
        topMargin=35,
        bottomMargin=35,
    )

    styles = build_styles()
    story = []

    patient = data.get("patient", {})
    doctor = data.get("doctor", {})
    assessment = data.get("clinical_assessment", {})
    attendance = data.get("attendance", {})
    prescriptions = data.get("prescriptions", [])
    sessions = data.get("sessions", [])

    patient_num = patient.get("patient_number") or patient.get("uhid") or "N/A"

    # Clinic Header
    header_data = [
        [
            Paragraph(f"<b>{clinic_name}</b>", styles["title"]),
            Paragraph("<b>CLINICAL DISCHARGE SUMMARY</b>", ParagraphStyle(
                "DocHeaderTag",
                parent=styles["title"],
                fontSize=12,
                leading=14,
                alignment=2,
                textColor=PRIMARY,
            )),
        ],
        [
            Paragraph("Panchakarma Treatment & Clinical Care Record", styles["subtitle"]),
            Paragraph(f"Date: <b>{datetime.now().strftime('%d %B %Y')}</b>", ParagraphStyle(
                "DocDateTag", parent=styles["bold"], alignment=2, textColor=TEXT_MUTED
            )),
        ],
    ]
    header_table = Table(header_data, colWidths=[330, 195])
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(header_table)
    story.append(HRFlowable(width="100%", thickness=1.5, color=PRIMARY, spaceBefore=6, spaceAfter=12))

    # Demographics & Assessment (2 columns)
    col1_text = (
        f"<b>PATIENT INFORMATION</b><br/>"
        f"<b>Name:</b> {patient.get('name', 'Patient')}<br/>"
        f"<b>Patient ID:</b> <font color='#2D5A27'><b>{patient_num}</b></font><br/>"
        f"<b>Gender:</b> {str(patient.get('gender', 'N/A')).capitalize()}<br/>"
        f"<b>Contact:</b> {patient.get('phone', '—')}"
    )
    col2_text = (
        f"<b>CLINICAL EVALUATION</b><br/>"
        f"<b>Consulting Vaidya:</b> Dr. {doctor.get('name', 'Vaidya')}<br/>"
        f"<b>Prakriti (Constitution):</b> <b>{assessment.get('prakriti') or 'Tridoshic'}</b><br/>"
        f"<b>Vikriti (Current Imbalance):</b> <b>{assessment.get('vikriti') or 'Vata-Pitta'}</b><br/>"
        f"<b>Chief Complaint:</b> {assessment.get('chief_complaint') or 'General Rejuvenation & Detox'}"
    )

    demo_data = [
        [Paragraph(col1_text, styles["normal"]), Paragraph(col2_text, styles["normal"])]
    ]
    demo_table = Table(demo_data, colWidths=[255, 270])
    demo_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), BG_LIGHT),
        ("BOX", (0, 0), (-1, -1), 1, BORDER_COLOR),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
    ]))
    story.append(demo_table)
    story.append(Spacer(1, 10))

    # Attendance Progress Box
    att_pct = attendance.get("session_attendance_percentage", 0)
    att_completed = attendance.get("completed_sessions", 0)
    att_total = attendance.get("total_planned_sessions", 0)
    att_notice = attendance.get("compliance_notice", "Measures session attendance, not clinical recovery.")

    att_box_content = [
        [
            Paragraph(
                f"<b>SESSION ATTENDANCE PROGRESS:</b> <font size='13' color='#065F46'><b>{att_pct}%</b></font><br/>"
                f"<font size='8' color='#2F855A'>Completed {att_completed} of {att_total} prescribed therapeutic sessions.</font>",
                styles["normal"],
            ),
            Paragraph(
                f"<font size='7.5' color='#718096'>* Clinical Compliance Note:<br/>{att_notice}</font>",
                styles["muted"],
            ),
        ]
    ]
    att_table = Table(att_box_content, colWidths=[340, 185])
    att_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), SUCCESS_BG),
        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#A7F3D0")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
    ]))
    story.append(att_table)
    story.append(Spacer(1, 12))

    # Prescribed Protocols Section
    story.append(Paragraph(f"<b>Prescribed Panchakarma Protocol: {data.get('title', 'Therapy Plan')}</b>", styles["section_heading"]))
    if prescriptions:
        rx_rows = [
            [
                Paragraph("<b>Therapy Procedure</b>", styles["table_header"]),
                Paragraph("<b>Sessions</b>", styles["table_header"]),
                Paragraph("<b>Duration</b>", styles["table_header"]),
                Paragraph("<b>Frequency</b>", styles["table_header"]),
                Paragraph("<b>Clinical Notes / Instructions</b>", styles["table_header"]),
            ]
        ]
        for p in prescriptions:
            rx_rows.append([
                Paragraph(f"<b>{p.get('therapy_name', 'Therapy')}</b>", styles["table_cell_bold"]),
                Paragraph(f"{p.get('session_count', 1)}", styles["table_cell"]),
                Paragraph(f"{p.get('duration_minutes', 45)} min", styles["table_cell"]),
                Paragraph(f"{p.get('frequency_per_week', 1)}x / week", styles["table_cell"]),
                Paragraph(f"{p.get('notes') or 'Standard therapeutic protocol'}", styles["table_cell"]),
            ])
        rx_table = Table(rx_rows, colWidths=[135, 55, 65, 80, 190])
        rx_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
            ("GRID", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(rx_table)
    story.append(Spacer(1, 10))

    # Therapy Session Logs (if any)
    if sessions:
        story.append(Paragraph("<b>Therapy Execution & Daily Observations Log</b>", styles["section_heading"]))
        sess_rows = [
            [
                Paragraph("<b>#</b>", styles["table_header"]),
                Paragraph("<b>Procedure</b>", styles["table_header"]),
                Paragraph("<b>Date</b>", styles["table_header"]),
                Paragraph("<b>Therapist & Room</b>", styles["table_header"]),
                Paragraph("<b>Status</b>", styles["table_header"]),
                Paragraph("<b>Observations / Medicated Oils</b>", styles["table_header"]),
            ]
        ]
        # Show up to 15 sessions in the printed report
        for s in sessions[:15]:
            status_str = s.get("status", "scheduled").upper()
            status_color = "#065F46" if status_str == "COMPLETED" else "#D97706"
            date_display = s["scheduled_at"][:10] if s.get("scheduled_at") else "—"
            therapist_room = f"{s.get('therapist_name', '—')}<br/><font size='7.5' color='#718096'>{s.get('room_name', '')}</font>"
            obs = s.get("observations") or s.get("oils_used") or "Standard protocol observed"

            sess_rows.append([
                Paragraph(f"{s.get('session_number', 1)}", styles["table_cell"]),
                Paragraph(f"<b>{s.get('therapy_name', 'Therapy')}</b>", styles["table_cell"]),
                Paragraph(date_display, styles["table_cell"]),
                Paragraph(therapist_room, styles["table_cell"]),
                Paragraph(f"<font color='{status_color}'><b>{status_str}</b></font>", styles["table_cell"]),
                Paragraph(obs, styles["table_cell"]),
            ])

        sess_table = Table(sess_rows, colWidths=[25, 120, 65, 115, 75, 125])
        sess_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
            ("GRID", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(sess_table)
        story.append(Spacer(1, 10))

    # Pathya & Vihara Discharge Advice
    diet = data.get("diet_recommendations") or "Warm, light, fresh satvik diet. Avoid cold water, curds at night, and spicy oily food."
    lifestyle = data.get("lifestyle_recommendations") or "Avoid heavy physical exertion, direct drafts, and late-night waking. Gentle walking and pranayama recommended."

    advice_content = [
        [Paragraph("<b>POST-TREATMENT DISCHARGE CARE PROTOCOL (PATHYA & VIHARA)</b>", ParagraphStyle(
            "AdviceHdr", parent=styles["subtitle"], textColor=colors.HexColor("#78350F")
        ))],
        [Paragraph(f"<b>Dietary Protocol (Pathya):</b> {diet}", styles["normal"])],
        [Paragraph(f"<b>Lifestyle Routine (Vihara):</b> {lifestyle}", styles["normal"])],
    ]
    advice_table = Table(advice_content, colWidths=[525])
    advice_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FFFBEB")),
        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#FDE68A")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
    ]))
    story.append(advice_table)
    story.append(Spacer(1, 25))

    # Signatures
    sig_content = [
        [
            Paragraph("<b>Patient Acknowledgement:</b>", styles["muted"]),
            Paragraph("<b>Authorized Ayurvedic Vaidya / Chief Physician:</b>", styles["muted"]),
        ],
        [Spacer(1, 24), Spacer(1, 24)],
        [
            Paragraph("____________________________<br/>Patient / Guardian Signature", styles["normal"]),
            Paragraph(f"____________________________<br/>Dr. {doctor.get('name', 'Ayurvedic Physician')}, BAMS<br/><font size='7.5' color='#718096'>Registration & Hospital Seal</font>", styles["normal"]),
        ],
    ]
    sig_table = Table(sig_content, colWidths=[255, 270])
    sig_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(KeepTogether(sig_table))

    doc.build(story)
    return buffer.getvalue()
