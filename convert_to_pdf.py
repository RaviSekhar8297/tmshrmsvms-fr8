#!/usr/bin/env python3
"""
Script to convert TMS_FEATURE_COMPARISON.html to PDF
Requires: pip install weasyprint
"""

import sys
import os

def convert_html_to_pdf():
    try:
        from weasyprint import HTML
        print("Converting HTML to PDF...")
        
        html_file = "TMS_FEATURE_COMPARISON.html"
        pdf_file = "TMS_FEATURE_COMPARISON.pdf"
        
        if not os.path.exists(html_file):
            print(f"Error: {html_file} not found!")
            return False
        
        HTML(filename=html_file).write_pdf(pdf_file)
        print(f"✅ Successfully created {pdf_file}")
        return True
        
    except ImportError:
        print("⚠️  WeasyPrint not installed.")
        print("\nTo install: pip install weasyprint")
        print("\nAlternatively, you can:")
        print("1. Open TMS_FEATURE_COMPARISON.html in your browser")
        print("2. Press Ctrl+P (or Cmd+P on Mac)")
        print("3. Select 'Save as PDF' as the destination")
        print("4. Click 'Save'")
        return False
    except Exception as e:
        print(f"Error converting to PDF: {e}")
        print("\nYou can still convert manually:")
        print("1. Open TMS_FEATURE_COMPARISON.html in your browser")
        print("2. Press Ctrl+P (or Cmd+P on Mac)")
        print("3. Select 'Save as PDF' as the destination")
        print("4. Click 'Save'")
        return False

if __name__ == "__main__":
    convert_html_to_pdf()
