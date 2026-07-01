import os
import csv
from datetime import datetime
from openpyxl import Workbook
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from models import Alert, Incident, LogEntry, ThreatIntel

def generate_csv_report(report_type, filepath):
    """
    Generates a CSV report based on the requested report type.
    """
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        
        if report_type == 'Alerts':
            alerts = Alert.query.order_by(Alert.created_at.desc()).all()
            writer.writerow(['ID', 'Title', 'Severity', 'Category', 'Source IP', 'Destination IP', 'Status', 'MITRE Technique', 'Created At'])
            for a in alerts:
                writer.writerow([a.id, a.title, a.severity, a.category, a.source_ip, a.destination_ip, a.status, a.mitre_technique or 'N/A', a.created_at])
                
        elif report_type == 'Incidents':
            incidents = Incident.query.order_by(Incident.created_at.desc()).all()
            writer.writerow(['ID', 'Title', 'Status', 'Severity', 'Assignee ID', 'Created At', 'Updated At', 'Resolution Notes'])
            for i in incidents:
                writer.writerow([i.id, i.title, i.status, i.severity, i.assignee_id, i.created_at, i.updated_at, i.resolution_notes or ''])
                
        elif report_type == 'Threat Intel':
            intel = ThreatIntel.query.order_by(ThreatIntel.reputation_score.desc()).all()
            writer.writerow(['ID', 'Type', 'Value', 'Reputation Score', 'Source Feed', 'Category', 'Description'])
            for i in intel:
                writer.writerow([i.id, i.indicator_type, i.value, i.reputation_score, i.source_feed, i.threat_category, i.description or ''])
                
        else: # System Logs
            logs = LogEntry.query.order_by(LogEntry.timestamp.desc()).limit(1000).all()
            writer.writerow(['ID', 'Timestamp', 'Log Source', 'Message', 'Severity', 'Is Malicious'])
            for l in logs:
                writer.writerow([l.id, l.timestamp, l.log_source, l.message, l.severity, l.is_malicious])

def generate_excel_report(report_type, filepath):
    """
    Generates a multi-tab Excel report containing security summary and details.
    """
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    wb = Workbook()
    
    # Tab 1: Summary Stats
    ws_summary = wb.active
    ws_summary.title = "Executive Summary"
    ws_summary.append(["SentinelShield SOC Report", f"Generated on {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC"])
    ws_summary.append([])
    
    alerts_total = Alert.query.count()
    critical_alerts = Alert.query.filter_by(severity='Critical').count()
    high_alerts = Alert.query.filter_by(severity='High').count()
    med_alerts = Alert.query.filter_by(severity='Medium').count()
    low_alerts = Alert.query.filter_by(severity='Low').count()
    incidents_total = Incident.query.count()
    open_incidents = Incident.query.filter(Incident.status != 'Closed').count()
    
    ws_summary.append(["Metric", "Count"])
    ws_summary.append(["Total Alerts Triggered", alerts_total])
    ws_summary.append(["Critical Severity Alerts", critical_alerts])
    ws_summary.append(["High Severity Alerts", high_alerts])
    ws_summary.append(["Medium Severity Alerts", med_alerts])
    ws_summary.append(["Low Severity Alerts", low_alerts])
    ws_summary.append(["Total Incidents Created", incidents_total])
    ws_summary.append(["Active (Open) Incidents", open_incidents])
    
    # Tab 2: Detailed Data
    ws_data = wb.create_sheet(title="Report Details")
    
    if report_type == 'Alerts':
        alerts = Alert.query.order_by(Alert.created_at.desc()).all()
        ws_data.append(['ID', 'Title', 'Severity', 'Category', 'Source IP', 'Destination IP', 'Status', 'MITRE Technique', 'Created At'])
        for a in alerts:
            ws_data.append([a.id, a.title, a.severity, a.category, a.source_ip, a.destination_ip, a.status, a.mitre_technique or 'N/A', a.created_at.strftime('%Y-%m-%d %H:%M:%S')])
            
    elif report_type == 'Incidents':
        incidents = Incident.query.order_by(Incident.created_at.desc()).all()
        ws_data.append(['ID', 'Title', 'Status', 'Severity', 'Assignee Username', 'Created At', 'Updated At', 'Resolution Notes'])
        for i in incidents:
            ws_data.append([i.id, i.title, i.status, i.severity, i.assignee.username if i.assignee else 'Unassigned', i.created_at.strftime('%Y-%m-%d %H:%M:%S'), i.updated_at.strftime('%Y-%m-%d %H:%M:%S'), i.resolution_notes or ''])
            
    elif report_type == 'Threat Intel':
        intel = ThreatIntel.query.order_by(ThreatIntel.reputation_score.desc()).all()
        ws_data.append(['ID', 'Type', 'Value', 'Reputation Score', 'Source Feed', 'Category', 'Description'])
        for i in intel:
            ws_data.append([i.id, i.indicator_type, i.value, i.reputation_score, i.source_feed, i.threat_category, i.description or ''])
            
    else: # System Logs
        logs = LogEntry.query.order_by(LogEntry.timestamp.desc()).limit(500).all()
        ws_data.append(['ID', 'Timestamp', 'Log Source', 'Message', 'Severity', 'Is Malicious'])
        for l in logs:
            ws_data.append([l.id, l.timestamp.strftime('%Y-%m-%d %H:%M:%S'), l.log_source, l.message, l.severity, l.is_malicious])
            
    wb.save(filepath)

def generate_pdf_report(report_type, filepath):
    """
    Generates a high-quality, formatted PDF security report.
    """
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    doc = SimpleDocTemplate(filepath, pagesize=letter, rightMargin=54, leftMargin=54, topMargin=54, bottomMargin=54)
    story = []
    
    styles = getSampleStyleSheet()
    
    # Custom Palette Styling
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=24,
        textColor=colors.HexColor('#0B1220'),
        spaceAfter=15
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=12,
        textColor=colors.HexColor('#4B5563'),
        spaceAfter=30
    )
    
    section_heading = ParagraphStyle(
        'SecHeading',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=14,
        textColor=colors.HexColor('#111827'),
        spaceBefore=15,
        spaceAfter=10
    )
    
    body_style = ParagraphStyle(
        'DocBody',
        parent=styles['BodyText'],
        fontName='Helvetica',
        fontSize=10,
        textColor=colors.HexColor('#1F2937'),
        spaceAfter=10
    )
    
    # Header
    story.append(Paragraph("SENTINELSHIELD CYBERSECURITY SOC REPORT", title_style))
    story.append(Paragraph(f"Report Type: {report_type} Security Operations Summary<br/>"
                           f"Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC<br/>"
                           f"Source: SentinelShield SOC Platform Security Reporting Engine", subtitle_style))
    story.append(Spacer(1, 10))
    
    # Executive Summary Table
    story.append(Paragraph("Executive Security Metrics Summary", section_heading))
    
    alerts_total = Alert.query.count()
    critical_alerts = Alert.query.filter_by(severity='Critical').count()
    high_alerts = Alert.query.filter_by(severity='High').count()
    incidents_total = Incident.query.count()
    active_incidents = Incident.query.filter(Incident.status != 'Closed').count()
    
    metrics_data = [
        [Paragraph("<b>Metric Name</b>", body_style), Paragraph("<b>Value</b>", body_style)],
        ["Total Security Alerts Logged", str(alerts_total)],
        ["Critical Severity Alerts", str(critical_alerts)],
        ["High Severity Alerts", str(high_alerts)],
        ["Total Incidents Tracked", str(incidents_total)],
        ["Unresolved / Active Incidents", str(active_incidents)]
    ]
    
    t_metrics = Table(metrics_data, colWidths=[300, 150])
    t_metrics.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0B1220')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E5E7EB')),
        ('BACKGROUND', (0,1), (-1,-1), colors.HexColor('#F9FAFB')),
    ]))
    story.append(t_metrics)
    story.append(Spacer(1, 20))
    
    # Detailed Table
    story.append(Paragraph(f"Detailed {report_type} Records", section_heading))
    
    if report_type == 'Alerts':
        alerts = Alert.query.order_by(Alert.created_at.desc()).limit(10).all()
        table_data = [["ID", "Title", "Severity", "Src IP", "Category"]]
        for a in alerts:
            table_data.append([str(a.id), a.title[:25], a.severity, a.source_ip, a.category])
            
    elif report_type == 'Incidents':
        incidents = Incident.query.order_by(Incident.created_at.desc()).limit(10).all()
        table_data = [["ID", "Title", "Status", "Severity", "Assignee"]]
        for i in incidents:
            table_data.append([str(i.id), i.title[:25], i.status, i.severity, i.assignee.username if i.assignee else 'Unassigned'])
            
    else: # Default System logs
        logs = LogEntry.query.order_by(LogEntry.timestamp.desc()).limit(12).all()
        table_data = [["ID", "Timestamp", "Source", "Message", "Severity"]]
        for l in logs:
            table_data.append([str(l.id), l.timestamp.strftime('%H:%M:%S'), l.log_source, l.message[:25], l.severity])
            
    t_details = Table(table_data, colWidths=[40, 150, 80, 100, 110])
    t_details.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#111827')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E5E7EB')),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#F3F4F6')])
    ]))
    story.append(t_details)
    story.append(Spacer(1, 15))
    story.append(Paragraph("<i>Note: This document contains sensitive security audit trails. Handle in accordance with internal corporate classification standards.</i>", body_style))
    
    doc.build(story)
