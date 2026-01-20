from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import or_, func, and_
from database import get_db
from routes.auth import get_current_user
from models import User, LeaveBalanceList
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
import re
import json

router = APIRouter()

class ChatbotRequest(BaseModel):
    question: str

class ChatbotResponse(BaseModel):
    answer: str
    image_base64: Optional[str] = None  # For user profile images
    selection_required: bool = False  # Whether user needs to select from multiple matches
    selection_data: Optional[List[Dict[str, Any]]] = None  # List of matches for selection
    selection_type: Optional[str] = None  # Type of selection: 'user' or 'leave'

def get_chatbot_response(question: str, user_role: str, db: Session = None, current_user: User = None) -> str:
    """
    Simple rule-based chatbot. Can be replaced with OpenAI API or other AI service.
    PRIORITY: User/Employee queries are checked FIRST before other topics.
    """
    question_lower = question.lower().strip()
    
    # Greetings
    if any(word in question_lower for word in ['hello', 'hi', 'hey', 'greetings']):
        return "Hello! I'm your TMS assistant. How can I help you today? You can ask me about leaves, attendance, tasks, payroll, or any other TMS features."
    
    # PRIORITY 1: User/Employee related questions - Check FIRST before other topics
    if db and current_user:
        # Check if question contains user/employee keywords OR contains empid pattern (numbers) OR specific fields
        has_user_keywords = any(word in question_lower for word in ['user', 'users', 'employee', 'employees', 'staff', 'team member', 'team members', 'empid', 'employee id'])
        has_empid_pattern = bool(re.search(r'\b(\d{4,})\b', question_lower))  # Check for 4+ digit numbers (likely empid)
        has_specific_fields = any(word in question_lower for word in ['dob', 'date of birth', 'birthday', 'birth date', 'doj', 'date of joining', 'joining date', 'when joined', 'phone', 'mobile', 'contact number', 'email', 'email address', 'mail id', 'designation', 'department', 'branch', 'role', 'empid', 'employee id', 'image', 'photo', 'picture', 'avatar', 'profile picture', 'profile image'])
        
        if has_user_keywords or has_empid_pattern or has_specific_fields:
            try:
                # Helper function to extract name from question (when asking "what is X of [name]?")
                def extract_name_from_question(question_lower):
                    """Extract person name from questions like 'what is empid of reshal?'"""
                    words = question_lower.split()
                    field_keywords = ['empid', 'dob', 'doj', 'phone', 'email', 'designation', 'department', 'branch', 'role', 'name', 'employee', 'id']
                    stop_words = ['what', 'is', 'the', 'a', 'an', 'of', 'for', 'with', 'who', 'which', 'when', 'where', 'how']
                    
                    # Pattern 1: "what is X of [name]?" or "X of [name]"
                    for i, word in enumerate(words):
                        if word == 'of' and i + 1 < len(words):
                            # Next word(s) might be the name
                            name_parts = []
                            for j in range(i + 1, min(i + 4, len(words))):
                                next_word = words[j]
                                # Stop if we hit a stop word, field keyword, or number
                                if (next_word in stop_words + field_keywords or 
                                    next_word.isdigit() or 
                                    next_word in ['?', '.', '!']):
                                    break
                                name_parts.append(next_word)
                            if name_parts:
                                return ' '.join(name_parts).rstrip('?.,!')
                    
                    # Pattern 2: "[name]'s X" or "[name] X"
                    for i, word in enumerate(words):
                        if "'s" in word or word.endswith("'s"):
                            # Word before 's might be name
                            name_part = word.replace("'s", "").replace("'", "").strip()
                            if name_part and not name_part.isdigit() and len(name_part) > 2 and name_part not in field_keywords + stop_words:
                                return name_part
                    
                    # Pattern 3: "X of [name]" where X is a field keyword
                    for i, word in enumerate(words):
                        if word in field_keywords and i + 1 < len(words):
                            next_word = words[i + 1]
                            if next_word == 'of' and i + 2 < len(words):
                                name_parts = []
                                for j in range(i + 2, min(i + 5, len(words))):
                                    next_w = words[j]
                                    if (next_w in stop_words + field_keywords or 
                                        next_w.isdigit() or 
                                        next_w in ['?', '.', '!']):
                                        break
                                    name_parts.append(next_w)
                                if name_parts:
                                    return ' '.join(name_parts).rstrip('?.,!')
                    
                    # Pattern 4: Look for words that are likely names (not keywords, not numbers, length > 2)
                    # This is a fallback - look for words that don't match any pattern
                    potential_names = []
                    for word in words:
                        clean_word = word.rstrip('?.,!')
                        if (len(clean_word) > 2 and 
                            not clean_word.isdigit() and 
                            clean_word not in field_keywords + stop_words and
                            clean_word not in ['the', 'a', 'an', 'is', 'are', 'was', 'were']):
                            potential_names.append(clean_word)
                    
                    # If we found potential names and the question contains a field keyword, return the first name
                    if potential_names and any(word in question_lower for word in field_keywords):
                        return potential_names[0] if len(potential_names) == 1 else ' '.join(potential_names[:2])
                    
                    return None
                
                # Helper function to search users by name - returns ALL matches
                def find_users_by_name(name):
                    """Search for users by name - returns list of all matches"""
                    if not name or len(name.strip()) < 2:
                        return []
                    name_clean = name.strip()
                    # Find all users matching the name
                    users = db.query(User).filter(
                        User.is_active == True,
                        User.name.ilike(f'%{name_clean}%')
                    ).limit(20).all()
                    return users
                
                # Helper function to get field value from user based on field variations
                def get_user_field_value(user, field_keywords):
                    """Get field value from user based on field keyword variations"""
                    # Field name variations mapping
                    field_mapping = {
                        'empid': ['empid', 'emp_id', 'employee_id', 'staff_id', 'user_id', 'personnel_id'],
                        'name': ['name', 'employee_name', 'full_name', 'staff_name', 'user_name', 'emp_name'],
                        'doj': ['doj', 'date_of_joining', 'joining_date', 'join_date', 'date_of_join', 'entry_date', 'employment_start_date', 'start_date'],
                        'email': ['email', 'email_id', 'email_address', 'official_email', 'work_email', 'contact_email'],
                        'phone': ['phone', 'mobile', 'mobile_no', 'phone_no', 'contact_number', 'mobile_number', 'telephone'],
                        'image_base64': ['image_base64', 'profile_image', 'profile_photo', 'employee_photo', 'user_image', 'image_data', 'avatar', 'photo_base64'],
                        'designation': ['designation', 'job_title', 'role', 'position', 'designation_name', 'job_role'],
                        'company_name': ['company_name', 'organization_name', 'employer_name', 'company', 'org_name', 'firm_name'],
                        'branch_name': ['branch_name', 'office_branch', 'branch', 'location', 'branch_location', 'office_name'],
                        'department_name': ['department_name', 'department', 'dept_name', 'division', 'team', 'functional_area']
                    }
                    
                    # Find which field is being asked for
                    for field_key, variations in field_mapping.items():
                        if any(keyword in field_keywords for keyword in variations):
                            if field_key == 'empid':
                                return user.empid
                            elif field_key == 'name':
                                return user.name
                            elif field_key == 'doj':
                                return user.doj.strftime('%d-%m-%Y') if user.doj else None
                            elif field_key == 'email':
                                return user.email
                            elif field_key == 'phone':
                                return user.phone
                            elif field_key == 'image_base64':
                                return user.image_base64
                            elif field_key == 'designation':
                                return user.designation
                            elif field_key == 'company_name':
                                return user.company_name
                            elif field_key == 'branch_name':
                                return user.branch_name
                            elif field_key == 'department_name':
                                return user.department_name
                    return None
                
                # UNIFIED FIELD QUERY HANDLER - Handles "what is [field] of [name]?" pattern
                # Check if question asks for a specific field OF a name (not empid)
                extracted_name = extract_name_from_question(question_lower)
                if extracted_name:
                    # Found a name in the question - search by name first (get ALL matches)
                    users = find_users_by_name(extracted_name)
                    
                    if users:
                        # If multiple users found, return selection response
                        if len(users) > 1:
                            # Build selection data
                            selection_data = []
                            for user in users:
                                selection_data.append({
                                    'empid': user.empid,
                                    'name': user.name,
                                    'designation': user.designation or 'N/A',
                                    'department': user.department_name or 'N/A'
                                })
                            
                            # Return special format for selection - show simple prompt message
                            # The actual names will be shown in the selection buttons
                            result_text = "Please select an employee:"
                            
                            # Return special format that will be parsed in endpoint
                            # Use |||SEPARATOR||| to avoid conflicts with JSON or text content
                            return f"SELECTION:USER|||SEPARATOR|||{json.dumps(selection_data)}|||SEPARATOR|||{result_text}"
                        
                        # Single user found - proceed with field query
                        user = users[0]
                        
                        # Get all field keyword variations
                        all_field_keywords = [
                            # empid variations
                            'empid', 'emp_id', 'employee_id', 'staff_id', 'user_id', 'personnel_id',
                            # name variations
                            'name', 'employee_name', 'full_name', 'staff_name', 'user_name', 'emp_name',
                            # doj variations
                            'doj', 'date_of_joining', 'joining_date', 'join_date', 'date_of_join', 'entry_date', 
                            'employment_start_date', 'start_date', 'date of joining', 'when joined',
                            # email variations
                            'email', 'email_id', 'email_address', 'official_email', 'work_email', 'contact_email', 'mail id',
                            # phone variations
                            'phone', 'mobile', 'mobile_no', 'phone_no', 'contact_number', 'mobile_number', 'telephone', 'phone number',
                            # image variations
                            'image', 'photo', 'picture', 'avatar', 'profile picture', 'profile image', 'profile_image', 
                            'profile_photo', 'employee_photo', 'user_image', 'image_data', 'photo_base64', 'image_base64',
                            # designation variations
                            'designation', 'job_title', 'role', 'position', 'designation_name', 'job_role',
                            # company_name variations
                            'company_name', 'organization_name', 'employer_name', 'company', 'org_name', 'firm_name',
                            # branch_name variations
                            'branch_name', 'office_branch', 'branch', 'location', 'branch_location', 'office_name',
                            # department_name variations
                            'department_name', 'department', 'dept_name', 'division', 'team', 'functional_area'
                        ]
                        
                        # Check which field is being asked for
                        field_value = get_user_field_value(user, all_field_keywords)
                        
                        if any(keyword in question_lower for keyword in ['empid', 'emp_id', 'employee_id', 'staff_id', 'user_id', 'personnel_id', 'employee id']):
                            return f"Employee ID for {user.name}:\n\n• Employee ID: {user.empid}"
                        
                        elif any(keyword in question_lower for keyword in ['dob', 'date of birth', 'birthday', 'birth date']):
                            if user.dob:
                                dob_str = user.dob.strftime('%d-%m-%Y')
                                age = (datetime.now().date() - user.dob).days // 365
                                return f"Date of Birth for {user.name} ({user.empid}):\n\n• DOB: {dob_str}\n• Age: {age} years"
                            else:
                                return f"Date of Birth is not available for {user.name} ({user.empid})."
                        
                        elif any(keyword in question_lower for keyword in ['doj', 'date_of_joining', 'joining_date', 'join_date', 'date_of_join', 'entry_date', 'employment_start_date', 'start_date', 'date of joining', 'when joined']):
                            if user.doj:
                                doj_str = user.doj.strftime('%d-%m-%Y')
                                years_worked = (datetime.now().date() - user.doj).days // 365
                                return f"Date of Joining for {user.name} ({user.empid}):\n\n• DOJ: {doj_str}\n• Experience: {years_worked} years"
                            else:
                                return f"Date of Joining is not available for {user.name} ({user.empid})."
                        
                        elif any(keyword in question_lower for keyword in ['email', 'email_id', 'email_address', 'official_email', 'work_email', 'contact_email', 'mail id']):
                            return f"Email for {user.name} ({user.empid}):\n\n• Email: {user.email}"
                        
                        elif any(keyword in question_lower for keyword in ['phone', 'mobile', 'mobile_no', 'phone_no', 'contact_number', 'mobile_number', 'telephone', 'phone number']):
                            if user.phone:
                                return f"Phone number for {user.name} ({user.empid}):\n\n• Phone: {user.phone}"
                            else:
                                return f"Phone number is not available for {user.name} ({user.empid})."
                        
                        elif any(keyword in question_lower for keyword in ['designation', 'job_title', 'position', 'designation_name', 'job_role']):
                            return f"Designation for {user.name} ({user.empid}):\n\n• Designation: {user.designation or 'N/A'}"
                        
                        elif any(keyword in question_lower for keyword in ['department_name', 'department', 'dept_name', 'division', 'team', 'functional_area']):
                            return f"Department for {user.name} ({user.empid}):\n\n• Department: {user.department_name or 'N/A'}"
                        
                        elif any(keyword in question_lower for keyword in ['branch_name', 'office_branch', 'branch', 'location', 'branch_location', 'office_name']):
                            return f"Branch for {user.name} ({user.empid}):\n\n• Branch: {user.branch_name or 'N/A'}"
                        
                        elif any(keyword in question_lower for keyword in ['company_name', 'organization_name', 'employer_name', 'company', 'org_name', 'firm_name']):
                            return f"Company for {user.name} ({user.empid}):\n\n• Company: {user.company_name or 'N/A'}"
                        
                        elif any(keyword in question_lower for keyword in ['image', 'photo', 'picture', 'avatar', 'profile picture', 'profile image', 'profile_image', 'profile_photo', 'employee_photo', 'user_image', 'image_data', 'photo_base64', 'image_base64']):
                            if user.image_base64 and user.image_base64.strip():
                                return f"IMAGE:{user.name}:{user.empid}:{user.image_base64}"
                            else:
                                return f"Profile image is not uploaded for {user.name} ({user.empid})."
                        
                        else:
                            # Name found but field not clear - return basic info
                            return f"Found user: {user.name} ({user.empid}). What information would you like? (empid, doj, phone, email, designation, department, branch, company, image)"
                    else:
                        return f"No user found with name '{extracted_name}'. Please check the name and try again."
                
                # If no name found, continue with existing empid-based queries
                # Specific field queries (DOB, DOJ, phone, email, etc.) - Check these FIRST
                if any(word in question_lower for word in ['dob', 'date of birth', 'birthday', 'birth date']):
                    # Extract empid from question
                    empid_match = re.search(r'\b(\d{4,})\b', question_lower)
                    if not empid_match:
                        # Try to find empid after keywords
                        words = question_lower.split()
                        for i, word in enumerate(words):
                            if word in ['empid', 'id', 'employee'] and i + 1 < len(words):
                                next_word = words[i + 1]
                                if next_word.isdigit() or 'bt-' in next_word.lower():
                                    empid = next_word.replace('bt-', '').replace('BT-', '')
                                    empid_match = type('obj', (object,), {'group': lambda x: empid})()
                                    break
                    
                    if empid_match:
                        empid = empid_match.group(1) if hasattr(empid_match, 'group') else str(empid_match)
                        # Try with and without BT- prefix
                        user = db.query(User).filter(
                            or_(
                                User.empid == empid,
                                User.empid == f"BT-{empid}",
                                User.empid.ilike(f'%{empid}%')
                            ),
                            User.is_active == True
                        ).first()
                        
                        if user:
                            if user.dob:
                                dob_str = user.dob.strftime('%d-%m-%Y')
                                age = (datetime.now().date() - user.dob).days // 365
                                return f"Date of Birth for {user.name} ({user.empid}):\n\n• DOB: {dob_str}\n• Age: {age} years"
                            else:
                                return f"Date of Birth is not available for {user.name} ({user.empid})."
                        else:
                            return f"No user found with Employee ID: {empid}. Please check the employee ID and try again."
                    else:
                        return "To get DOB, please specify the employee ID. For example: 'What is DOB of empid 1027' or 'Date of birth of BT-1027'"
                
                # Helper function to handle field queries for a user
                def get_field_response_for_user(user, question_lower):
                    """Get field response for a user based on question keywords"""
                    # DOJ variations
                    doj_keywords = ['doj', 'date_of_joining', 'joining_date', 'join_date', 'date_of_join', 'entry_date', 
                                   'employment_start_date', 'start_date', 'date of joining', 'when joined']
                    if any(keyword in question_lower for keyword in doj_keywords):
                        if user.doj:
                            doj_str = user.doj.strftime('%d-%m-%Y')
                            years_worked = (datetime.now().date() - user.doj).days // 365
                            return f"Date of Joining for {user.name} ({user.empid}):\n\n• DOJ: {doj_str}\n• Experience: {years_worked} years"
                        else:
                            return f"Date of Joining is not available for {user.name} ({user.empid})."
                    
                    # Email variations
                    email_keywords = ['email', 'email_id', 'email_address', 'official_email', 'work_email', 'contact_email', 'mail id']
                    if any(keyword in question_lower for keyword in email_keywords):
                        return f"Email for {user.name} ({user.empid}):\n\n• Email: {user.email}"
                    
                    # Phone variations
                    phone_keywords = ['phone', 'mobile', 'mobile_no', 'phone_no', 'contact_number', 'mobile_number', 'telephone', 'phone number']
                    if any(keyword in question_lower for keyword in phone_keywords):
                        if user.phone:
                            return f"Phone number for {user.name} ({user.empid}):\n\n• Phone: {user.phone}"
                        else:
                            return f"Phone number is not available for {user.name} ({user.empid})."
                    
                    # Designation variations
                    designation_keywords = ['designation', 'job_title', 'position', 'designation_name', 'job_role']
                    if any(keyword in question_lower for keyword in designation_keywords):
                        return f"Designation for {user.name} ({user.empid}):\n\n• Designation: {user.designation or 'N/A'}"
                    
                    # Department variations
                    dept_keywords = ['department_name', 'department', 'dept_name', 'division', 'team', 'functional_area']
                    if any(keyword in question_lower for keyword in dept_keywords):
                        return f"Department for {user.name} ({user.empid}):\n\n• Department: {user.department_name or 'N/A'}"
                    
                    # Branch variations
                    branch_keywords = ['branch_name', 'office_branch', 'branch', 'location', 'branch_location', 'office_name']
                    if any(keyword in question_lower for keyword in branch_keywords):
                        return f"Branch for {user.name} ({user.empid}):\n\n• Branch: {user.branch_name or 'N/A'}"
                    
                    # Company variations
                    company_keywords = ['company_name', 'organization_name', 'employer_name', 'company', 'org_name', 'firm_name']
                    if any(keyword in question_lower for keyword in company_keywords):
                        return f"Company for {user.name} ({user.empid}):\n\n• Company: {user.company_name or 'N/A'}"
                    
                    # Image variations
                    image_keywords = ['image', 'photo', 'picture', 'avatar', 'profile picture', 'profile image', 'profile_image', 
                                     'profile_photo', 'employee_photo', 'user_image', 'image_data', 'photo_base64', 'image_base64']
                    if any(keyword in question_lower for keyword in image_keywords):
                        if user.image_base64 and user.image_base64.strip():
                            return f"IMAGE:{user.name}:{user.empid}:{user.image_base64}"
                        else:
                            return f"Profile image is not uploaded for {user.name} ({user.empid})."
                    
                    return None
                
                # DOJ (Date of Joining) queries - with all variations
                doj_keywords = ['doj', 'date_of_joining', 'joining_date', 'join_date', 'date_of_join', 'entry_date', 
                               'employment_start_date', 'start_date', 'date of joining', 'when joined']
                if any(keyword in question_lower for keyword in doj_keywords):
                    empid_match = re.search(r'\b(\d{4,})\b', question_lower)
                    if not empid_match:
                        words = question_lower.split()
                        for i, word in enumerate(words):
                            if word in ['empid', 'id', 'employee'] and i + 1 < len(words):
                                next_word = words[i + 1]
                                if next_word.isdigit() or 'bt-' in next_word.lower():
                                    empid = next_word.replace('bt-', '').replace('BT-', '')
                                    empid_match = type('obj', (object,), {'group': lambda x: empid})()
                                    break
                    
                    if empid_match:
                        empid = empid_match.group(1) if hasattr(empid_match, 'group') else str(empid_match)
                        user = db.query(User).filter(
                            or_(
                                User.empid == empid,
                                User.empid == f"BT-{empid}",
                                User.empid.ilike(f'%{empid}%')
                            ),
                            User.is_active == True
                        ).first()
                        
                        if user:
                            response = get_field_response_for_user(user, question_lower)
                            if response:
                                return response
                            # Fallback if field not matched
                            if user.doj:
                                doj_str = user.doj.strftime('%d-%m-%Y')
                                years_worked = (datetime.now().date() - user.doj).days // 365
                                return f"Date of Joining for {user.name} ({user.empid}):\n\n• DOJ: {doj_str}\n• Experience: {years_worked} years"
                            else:
                                return f"Date of Joining is not available for {user.name} ({user.empid})."
                        else:
                            return f"No user found with Employee ID: {empid}."
                    else:
                        return "To get DOJ, please specify the employee ID or name. For example: 'date_of_joining of empid 1027' or 'doj of ravi'"
                
                # Phone number queries - with all variations
                phone_keywords = ['phone', 'mobile', 'mobile_no', 'phone_no', 'contact_number', 'mobile_number', 'telephone', 'phone number']
                if any(keyword in question_lower for keyword in phone_keywords):
                    empid_match = re.search(r'\b(\d{4,})\b', question_lower)
                    if not empid_match:
                        words = question_lower.split()
                        for i, word in enumerate(words):
                            if word in ['empid', 'id', 'employee'] and i + 1 < len(words):
                                next_word = words[i + 1]
                                if next_word.isdigit() or 'bt-' in next_word.lower():
                                    empid = next_word.replace('bt-', '').replace('BT-', '')
                                    empid_match = type('obj', (object,), {'group': lambda x: empid})()
                                    break
                    
                    if empid_match:
                        empid = empid_match.group(1) if hasattr(empid_match, 'group') else str(empid_match)
                        user = db.query(User).filter(
                            or_(
                                User.empid == empid,
                                User.empid == f"BT-{empid}",
                                User.empid.ilike(f'%{empid}%')
                            ),
                            User.is_active == True
                        ).first()
                        
                        if user:
                            response = get_field_response_for_user(user, question_lower)
                            if response:
                                return response
                        else:
                            return f"No user found with Employee ID: {empid}."
                    else:
                        return "To get phone number, please specify the employee ID or name. For example: 'phone of empid 1027' or 'mobile of ravi'"
                
                # Email queries - with all variations
                email_keywords = ['email', 'email_id', 'email_address', 'official_email', 'work_email', 'contact_email', 'mail id']
                if any(keyword in question_lower for keyword in email_keywords):
                    empid_match = re.search(r'\b(\d{4,})\b', question_lower)
                    if not empid_match:
                        words = question_lower.split()
                        for i, word in enumerate(words):
                            if word in ['empid', 'id', 'employee'] and i + 1 < len(words):
                                next_word = words[i + 1]
                                if next_word.isdigit() or 'bt-' in next_word.lower():
                                    empid = next_word.replace('bt-', '').replace('BT-', '')
                                    empid_match = type('obj', (object,), {'group': lambda x: empid})()
                                    break
                    
                    if empid_match:
                        empid = empid_match.group(1) if hasattr(empid_match, 'group') else str(empid_match)
                        user = db.query(User).filter(
                            or_(
                                User.empid == empid,
                                User.empid == f"BT-{empid}",
                                User.empid.ilike(f'%{empid}%')
                            ),
                            User.is_active == True
                        ).first()
                        
                        if user:
                            response = get_field_response_for_user(user, question_lower)
                            if response:
                                return response
                        else:
                            return f"No user found with Employee ID: {empid}."
                    else:
                        return "To get email, please specify the employee ID or name. For example: 'email of empid 1027' or 'email_address of ravi'"
                
                # Image queries (empid-based) - with all variations
                image_keywords = ['image', 'photo', 'picture', 'avatar', 'profile picture', 'profile image', 'profile_image', 
                                 'profile_photo', 'employee_photo', 'user_image', 'image_data', 'photo_base64', 'image_base64']
                if any(keyword in question_lower for keyword in image_keywords):
                    empid_match = re.search(r'\b(\d{4,})\b', question_lower)
                    if not empid_match:
                        words = question_lower.split()
                        for i, word in enumerate(words):
                            if word in ['empid', 'id', 'employee'] and i + 1 < len(words):
                                next_word = words[i + 1]
                                if next_word.isdigit() or 'bt-' in next_word.lower():
                                    empid = next_word.replace('bt-', '').replace('BT-', '')
                                    empid_match = type('obj', (object,), {'group': lambda x: empid})()
                                    break
                    
                    if empid_match:
                        empid = empid_match.group(1) if hasattr(empid_match, 'group') else str(empid_match)
                        user = db.query(User).filter(
                            or_(
                                User.empid == empid,
                                User.empid == f"BT-{empid}",
                                User.empid.ilike(f'%{empid}%')
                            ),
                            User.is_active == True
                        ).first()
                        
                        if user:
                            response = get_field_response_for_user(user, question_lower)
                            if response:
                                return response
                        else:
                            return f"No user found with Employee ID: {empid}."
                    else:
                        return "To get profile image, please specify the employee ID or name. For example: 'image of ravi' or 'photo of empid 1027'"
                
                # Count total users
                elif any(word in question_lower for word in ['count', 'how many', 'total', 'number of']):
                    total_users = db.query(func.count(User.id)).filter(User.is_active == True).scalar()
                    total_employees = db.query(func.count(User.id)).filter(
                        User.is_active == True,
                        User.role == 'Employee'
                    ).scalar()
                    total_managers = db.query(func.count(User.id)).filter(
                        User.is_active == True,
                        User.role == 'Manager'
                    ).scalar()
                    total_hr = db.query(func.count(User.id)).filter(
                        User.is_active == True,
                        User.role == 'HR'
                    ).scalar()
                    total_admins = db.query(func.count(User.id)).filter(
                        User.is_active == True,
                        User.role == 'Admin'
                    ).scalar()
                    
                    return f"Here's the user count in the system:\n\n• Total Active Users: {total_users}\n• Employees: {total_employees}\n• Managers: {total_managers}\n• HR: {total_hr}\n• Admins: {total_admins}"
                
                # Search for specific user
                elif any(word in question_lower for word in ['find', 'search', 'who is', 'details of', 'information about']):
                    # Try to extract name or empid from question
                    words = question_lower.split()
                    search_term = None
                    
                    # Look for empid pattern
                    empid_match = re.search(r'\b(\d{4,})\b', question_lower)
                    if empid_match:
                        search_term = empid_match.group(1)
                    else:
                        for i, word in enumerate(words):
                            if word in ['is', 'named', 'called', 'empid', 'id'] and i + 1 < len(words):
                                search_term = words[i + 1]
                                break
                        
                        # If no specific term, try to find any name-like words
                        if not search_term:
                            for word in words:
                                if len(word) > 2 and word not in ['the', 'and', 'for', 'with', 'find', 'search', 'who', 'is', 'user', 'employee', 'what', 'dob', 'doj']:
                                    search_term = word
                                    break
                    
                    if search_term:
                        # Check if it's a number (empid) or text (name)
                        if search_term.isdigit() or 'bt-' in search_term.lower():
                            # Search by empid
                            empid = search_term.replace('bt-', '').replace('BT-', '')
                            users = db.query(User).filter(
                                User.is_active == True,
                                or_(
                                    User.empid == empid,
                                    User.empid == f"BT-{empid}",
                                    User.empid.ilike(f'%{empid}%')
                                )
                            ).limit(10).all()
                        else:
                            # Search by name or email
                            users = db.query(User).filter(
                                User.is_active == True,
                                or_(
                                    User.name.ilike(f'%{search_term}%'),
                                    User.email.ilike(f'%{search_term}%')
                                )
                            ).limit(10).all()
                        
                        if users:
                            if len(users) == 1:
                                user = users[0]
                                result = f"Found user:\n\n• Name: {user.name}\n• Employee ID: {user.empid}\n• Email: {user.email}\n• Role: {user.role}\n• Designation: {user.designation or 'N/A'}\n• Phone: {user.phone or 'N/A'}\n• Department: {user.department_name or 'N/A'}\n• Branch: {user.branch_name or 'N/A'}"
                                if user.dob:
                                    dob_str = user.dob.strftime('%d-%m-%Y')
                                    result += f"\n• Date of Birth: {dob_str}"
                                if user.doj:
                                    doj_str = user.doj.strftime('%d-%m-%Y')
                                    result += f"\n• Date of Joining: {doj_str}"
                                return result
                            else:
                                result = f"Found {len(users)} users matching '{search_term}':\n\n"
                                for user in users[:5]:
                                    result += f"• {user.name} ({user.empid}) - {user.role}\n"
                                if len(users) > 5:
                                    result += f"\n... and {len(users) - 5} more. Please be more specific."
                                return result
                        else:
                            return f"No users found matching '{search_term}'. Please try a different search term."
                    else:
                        return "To search for a user, please mention their name, employee ID, or email. For example: 'Find user John' or 'Search employee BT-1027'"
                
                # List users by role
                elif any(word in question_lower for word in ['list', 'show', 'all employees', 'all managers', 'all hr']):
                    if 'employee' in question_lower or 'employees' in question_lower:
                        if user_role in ['Admin', 'HR', 'Manager']:
                            users = db.query(User).filter(
                                User.is_active == True,
                                User.role == 'Employee'
                            ).order_by(User.name).limit(20).all()
                            
                            if users:
                                result = f"Here are the employees ({len(users)} shown):\n\n"
                                for user in users:
                                    result += f"• {user.name} ({user.empid})"
                                    if user.designation:
                                        result += f" - {user.designation}"
                                    result += "\n"
                                if len(users) == 20:
                                    result += "\n(Showing first 20. Use the Users page to see all.)"
                                return result
                            else:
                                return "No active employees found."
                        else:
                            return "Employee list is only available to Admin, HR, and Manager roles."
                    
                    elif 'manager' in question_lower or 'managers' in question_lower:
                        if user_role in ['Admin', 'HR']:
                            users = db.query(User).filter(
                                User.is_active == True,
                                User.role == 'Manager'
                            ).order_by(User.name).all()
                            
                            if users:
                                result = f"Here are the managers ({len(users)}):\n\n"
                                for user in users:
                                    result += f"• {user.name} ({user.empid})\n"
                                return result
                            else:
                                return "No active managers found."
                        else:
                            return "Manager list is only available to Admin and HR roles."
                    
                    elif 'hr' in question_lower:
                        if user_role == 'Admin':
                            users = db.query(User).filter(
                                User.is_active == True,
                                User.role == 'HR'
                            ).order_by(User.name).all()
                            
                            if users:
                                result = f"Here are the HR staff ({len(users)}):\n\n"
                                for user in users:
                                    result += f"• {user.name} ({user.empid})\n"
                                return result
                            else:
                                return "No active HR staff found."
                        else:
                            return "HR list is only available to Admin role."
                    else:
                        return "I can list employees, managers, or HR staff. What would you like to see?"
                
                # My team / reporting to me
                elif any(word in question_lower for word in ['my team', 'reporting to me', 'my employees', 'team members']):
                    if user_role in ['Manager', 'HR', 'Admin']:
                        if user_role == 'Manager':
                            team = db.query(User).filter(
                                User.is_active == True,
                                User.report_to_id == current_user.empid
                            ).order_by(User.name).all()
                        else:
                            # HR and Admin can see all
                            team = db.query(User).filter(
                                User.is_active == True,
                                User.role == 'Employee'
                            ).order_by(User.name).limit(20).all()
                        
                        if team:
                            result = f"Your team members ({len(team)}):\n\n"
                            for member in team:
                                result += f"• {member.name} ({member.empid})"
                                if member.designation:
                                    result += f" - {member.designation}"
                                result += "\n"
                            return result
                        else:
                            return "No team members found reporting to you."
                    else:
                        return "Team information is available to Manager, HR, and Admin roles."
                
                # Contact information
                elif any(word in question_lower for word in ['contact', 'phone', 'email', 'reach']):
                    return "To view contact information:\n1. Go to Users page (Admin/Manager/HR)\n2. Or go to Employee → Contact Details\n3. You can see phone numbers and email addresses\n\nFor specific contact info, ask: 'Find contact for [name]'"
                
                else:
                    return "I can help you with user information:\n• Count of users by role\n• Search for specific user\n• List employees/managers/HR\n• View your team members\n• Contact information\n• DOB, DOJ, phone, email queries\n\nWhat would you like to know?"
            except Exception as e:
                print(f"Error querying users: {e}")
                import traceback
                traceback.print_exc()
                return f"I encountered an error while searching users. Please try again or contact support."
    
    # PRIORITY 2: Leave balance queries (check before general leave questions)
    if db and current_user:
        # Check for leave balance field keywords
        leave_balance_keywords = [
            'total_casual_leaves', 'total_cl', 'total_casual', 'allocated_casual_leaves', 'entitled_casual_leaves', 'casual_leave_quota',
            'used_casual_leaves', 'used_cl', 'availed_casual_leaves', 'taken_casual_leaves', 'consumed_casual_leaves',
            'balance_casual_leaves', 'remaining_casual_leaves', 'available_casual_leaves', 'balance_cl', 'pending_casual_leaves',
            'total_sick_leaves', 'total_sl', 'allocated_sick_leaves', 'entitled_sick_leaves', 'sick_leave_quota',
            'used_sick_leaves', 'used_sl', 'availed_sick_leaves', 'taken_sick_leaves', 'consumed_sick_leaves',
            'balance_sick_leaves', 'remaining_sick_leaves', 'available_sick_leaves', 'balance_sl', 'pending_sick_leaves',
            'total_comp_off_leaves', 'total_comp_off', 'comp_off_quota', 'allocated_comp_off_leaves', 'earned_comp_off_leaves',
            'used_comp_off_leaves', 'used_comp_off', 'availed_comp_off_leaves', 'taken_comp_off_leaves', 'consumed_comp_off',
            'balance_comp_off_leaves', 'remaining_comp_off_leaves', 'available_comp_off_leaves', 'balance_comp_off', 'pending_comp_off',
            'leave balance', 'leave_balance', 'casual leave', 'sick leave', 'comp off'
        ]
        
        has_leave_balance_keywords = any(keyword in question_lower for keyword in leave_balance_keywords)
        
        if has_leave_balance_keywords:
            try:
                # Extract name or empid from question
                extracted_name = extract_name_from_question(question_lower)
                empid_match = re.search(r'\b(\d{4,})\b', question_lower)
                
                # Get current year
                current_year = datetime.now().year
                
                # If name extracted, find users
                if extracted_name:
                    users = find_users_by_name(extracted_name)
                    
                    if users:
                        # Multiple users found - return selection
                        if len(users) > 1:
                            selection_data = []
                            for user in users:
                                # Get leave balance for each user
                                leave_balance = db.query(LeaveBalanceList).filter(
                                    and_(
                                        LeaveBalanceList.empid == int(user.empid) if user.empid and str(user.empid).isdigit() else None,
                                        LeaveBalanceList.year == current_year
                                    )
                                ).first() if user.empid and str(user.empid).isdigit() else None
                                
                                selection_data.append({
                                    'empid': user.empid,
                                    'name': user.name,
                                    'designation': user.designation or 'N/A'
                                })
                            
                            # Show simple prompt message - names will be in selection buttons
                            result_text = "Please select an employee:"
                            
                            # Use |||SEPARATOR||| to avoid conflicts with JSON or text content
                            return f"SELECTION:LEAVE|||SEPARATOR|||{json.dumps(selection_data)}|||SEPARATOR|||{result_text}"
                        
                        # Single user found
                        user = users[0]
                        empid_value = int(user.empid) if user.empid and str(user.empid).isdigit() else None
                    else:
                        return f"No user found with name '{extracted_name}'. Please check the name and try again."
                
                # If empid found in question
                elif empid_match:
                    empid = empid_match.group(1)
                    user = db.query(User).filter(
                        or_(
                            User.empid == empid,
                            User.empid == f"BT-{empid}",
                            User.empid.ilike(f'%{empid}%')
                        ),
                        User.is_active == True
                    ).first()
                    
                    if user:
                        empid_value = int(user.empid) if user.empid and str(user.empid).isdigit() else None
                    else:
                        return f"No user found with Employee ID: {empid}."
                else:
                    # No name or empid - use current user
                    empid_value = int(current_user.empid) if current_user.empid and str(current_user.empid).isdigit() else None
                    user = current_user
                
                if empid_value:
                    # Get leave balance
                    leave_balance = db.query(LeaveBalanceList).filter(
                        and_(
                            LeaveBalanceList.empid == empid_value,
                            LeaveBalanceList.year == current_year
                        )
                    ).first()
                    
                    if leave_balance:
                        # Determine which field is being asked for
                        result = f"Leave Balance for {user.name if user else 'Employee'} ({user.empid if user else empid_value}) - Year {current_year}:\n\n"
                        
                        # Casual leave fields
                        if any(keyword in question_lower for keyword in ['total_casual', 'total_cl', 'allocated_casual', 'entitled_casual', 'casual_quota']):
                            result += f"• Total Casual Leaves: {float(leave_balance.total_casual_leaves) if leave_balance.total_casual_leaves else 0}\n"
                        elif any(keyword in question_lower for keyword in ['used_casual', 'used_cl', 'availed_casual', 'taken_casual', 'consumed_casual']):
                            result += f"• Used Casual Leaves: {float(leave_balance.used_casual_leaves) if leave_balance.used_casual_leaves else 0}\n"
                        elif any(keyword in question_lower for keyword in ['balance_casual', 'balance_cl', 'remaining_casual', 'available_casual', 'pending_casual']):
                            result += f"• Balance Casual Leaves: {float(leave_balance.balance_casual_leaves) if leave_balance.balance_casual_leaves else 0}\n"
                        # Sick leave fields
                        elif any(keyword in question_lower for keyword in ['total_sick', 'total_sl', 'allocated_sick', 'entitled_sick', 'sick_quota']):
                            result += f"• Total Sick Leaves: {float(leave_balance.total_sick_leaves) if leave_balance.total_sick_leaves else 0}\n"
                        elif any(keyword in question_lower for keyword in ['used_sick', 'used_sl', 'availed_sick', 'taken_sick', 'consumed_sick']):
                            result += f"• Used Sick Leaves: {float(leave_balance.used_sick_leaves) if leave_balance.used_sick_leaves else 0}\n"
                        elif any(keyword in question_lower for keyword in ['balance_sick', 'balance_sl', 'remaining_sick', 'available_sick', 'pending_sick']):
                            result += f"• Balance Sick Leaves: {float(leave_balance.balance_sick_leaves) if leave_balance.balance_sick_leaves else 0}\n"
                        # Comp off fields
                        elif any(keyword in question_lower for keyword in ['total_comp_off', 'comp_off_quota', 'allocated_comp_off', 'earned_comp_off']):
                            result += f"• Total Comp Off Leaves: {float(leave_balance.total_comp_off_leaves) if leave_balance.total_comp_off_leaves else 0}\n"
                        elif any(keyword in question_lower for keyword in ['used_comp_off', 'availed_comp_off', 'taken_comp_off', 'consumed_comp_off']):
                            result += f"• Used Comp Off Leaves: {float(leave_balance.used_comp_off_leaves) if leave_balance.used_comp_off_leaves else 0}\n"
                        elif any(keyword in question_lower for keyword in ['balance_comp_off', 'remaining_comp_off', 'available_comp_off', 'pending_comp_off']):
                            result += f"• Balance Comp Off Leaves: {float(leave_balance.balance_comp_off_leaves) if leave_balance.balance_comp_off_leaves else 0}\n"
                        else:
                            # Show all leave balances
                            result += f"• Total Casual Leaves: {float(leave_balance.total_casual_leaves) if leave_balance.total_casual_leaves else 0}\n"
                            result += f"• Used Casual Leaves: {float(leave_balance.used_casual_leaves) if leave_balance.used_casual_leaves else 0}\n"
                            result += f"• Balance Casual Leaves: {float(leave_balance.balance_casual_leaves) if leave_balance.balance_casual_leaves else 0}\n\n"
                            result += f"• Total Sick Leaves: {float(leave_balance.total_sick_leaves) if leave_balance.total_sick_leaves else 0}\n"
                            result += f"• Used Sick Leaves: {float(leave_balance.used_sick_leaves) if leave_balance.used_sick_leaves else 0}\n"
                            result += f"• Balance Sick Leaves: {float(leave_balance.balance_sick_leaves) if leave_balance.balance_sick_leaves else 0}\n\n"
                            result += f"• Total Comp Off Leaves: {float(leave_balance.total_comp_off_leaves) if leave_balance.total_comp_off_leaves else 0}\n"
                            result += f"• Used Comp Off Leaves: {float(leave_balance.used_comp_off_leaves) if leave_balance.used_comp_off_leaves else 0}\n"
                            result += f"• Balance Comp Off Leaves: {float(leave_balance.balance_comp_off_leaves) if leave_balance.balance_comp_off_leaves else 0}\n"
                        
                        return result
                    else:
                        return f"Leave balance not found for {user.name if user else 'Employee'} ({user.empid if user else empid_value}) for year {current_year}."
                else:
                    return "Unable to determine employee. Please specify name or employee ID."
                    
            except Exception as e:
                print(f"Error querying leave balance: {e}")
                import traceback
                traceback.print_exc()
                return f"I encountered an error while searching leave balance. Please try again."
    
    # PRIORITY 3: Leave related questions (only if not a user query or leave balance query)
    if any(word in question_lower for word in ['leave', 'holiday', 'vacation', 'time off']):
        if 'apply' in question_lower or 'how to apply' in question_lower:
            return "To apply for leave:\n1. Go to Employee → Apply Leave\n2. Select leave type (Sick, Casual, Annual, etc.)\n3. Choose start and end dates\n4. Add reason if required\n5. Submit your request\n\nYour manager/HR will review and approve it."
        elif 'balance' in question_lower or 'remaining' in question_lower:
            return "To check your leave balance:\n1. Go to Employee → Leaves List\n2. You'll see your available leave balance for each type\n\nFor detailed balance, HR can check Employee → Balance Leaves.\n\nYou can also ask: 'balance_casual_leaves of [name]' or 'leave balance of [empid]'"
        elif 'types' in question_lower or 'kinds' in question_lower:
            return "Available leave types:\n• Sick Leave (SL)\n• Casual Leave (CL)\n• Annual Leave (AL)\n• Emergency Leave\n• Other Leave\n\nEach has different rules and approval processes."
        else:
            return "I can help you with leave-related questions:\n• How to apply for leave\n• Check leave balance\n• Leave types available\n• Leave approval status\n\nWhat would you like to know?"
    
    # Attendance related questions
    if any(word in question_lower for word in ['attendance', 'punch', 'check in', 'check out']):
        if 'punch' in question_lower or 'check in' in question_lower:
            return "To punch in/out:\n1. Go to Self → Punch\n2. Click 'Punch In' when you arrive\n3. Click 'Punch Out' when you leave\n4. You can add location and remarks if needed\n\nYour attendance is automatically recorded."
        elif 'history' in question_lower or 'view' in question_lower:
            return "To view attendance history:\n1. Go to Attendance → History\n2. Select month and year\n3. View your attendance records with in-time, out-time, and status\n\nYou can also download the data as Excel."
        elif 'mark' in question_lower or 'modify' in question_lower:
            if user_role in ['HR', 'Admin']:
                return "To modify attendance:\n1. Go to Attendance → Modify\n2. Select employee and date\n3. Enter check-in/check-out times\n4. Save changes\n\nOnly HR and Admin can modify attendance."
            else:
                return "Attendance modification is only available to HR and Admin. Please contact your HR for attendance corrections."
        else:
            return "I can help you with attendance:\n• How to punch in/out\n• View attendance history\n• Download attendance reports\n• Modify attendance (HR/Admin only)\n\nWhat do you need?"
    
    # Task related questions
    if any(word in question_lower for word in ['task', 'project', 'work', 'assignment']):
        if 'create' in question_lower or 'add' in question_lower:
            if user_role in ['Admin', 'Manager', 'HR']:
                return "To create a task:\n1. Go to Tasks page\n2. Click 'Add Task' or 'New Task'\n3. Fill in task details (title, description, assignee, due date)\n4. Set priority and status\n5. Save the task\n\nYou can assign tasks to team members."
            else:
                return "Task creation is available to Admin, Manager, and HR. As an employee, you can view and update tasks assigned to you."
        elif 'view' in question_lower or 'see' in question_lower:
            return "To view tasks:\n1. Go to Tasks page\n2. You'll see all tasks assigned to you\n3. Click on a task to see details\n4. Update status, add comments, or log time\n\nYou can filter and search tasks."
        else:
            return "I can help with tasks:\n• Create new tasks (Manager/HR/Admin)\n• View assigned tasks\n• Update task status\n• Add comments and time logs\n• Track task progress\n\nWhat would you like to know?"
    
    # Payroll related questions
    if any(word in question_lower for word in ['salary', 'payroll', 'payslip', 'payment']):
        if 'payslip' in question_lower or 'view' in question_lower:
            return "To view your payslip:\n1. Go to Payroll → Payslip\n2. Select the month and year\n3. View your detailed payslip\n4. Download as PDF if needed\n\nPayslips show your salary breakdown, deductions, and net pay."
        elif 'structure' in question_lower:
            if user_role in ['HR', 'Admin']:
                return "To manage salary structure:\n1. Go to Payroll → Salary Structure\n2. View or edit employee salary details\n3. Set basic salary, allowances, deductions\n4. Export/import salary data\n\nOnly HR and Admin can access this."
            else:
                return "Salary structure management is only available to HR and Admin. Contact HR for salary-related queries."
        else:
            return "I can help with payroll:\n• View payslips\n• Check salary structure (HR/Admin)\n• Generate payroll (HR/Admin)\n• Download payslip PDFs\n\nWhat do you need?"
    
    # Profile/Settings questions
    if any(word in question_lower for word in ['profile', 'settings', 'account', 'personal']):
        return "To update your profile:\n1. Go to Profile page\n2. Click 'Edit' to modify your information\n3. Update name, email, phone, etc.\n4. Change password if needed\n5. Save changes\n\nYou can also update contact details in Employee → Contact Details."
    
    # Help/Support questions
    if any(word in question_lower for word in ['help', 'support', 'issue', 'problem', 'error']):
        return "I'm here to help! You can ask me about:\n• Leaves and holidays\n• Attendance and punching\n• Tasks and projects\n• Payroll and payslips\n• Profile settings\n• System features\n\nIf you're facing a technical issue, please contact your system administrator or HR."
    
    # Policies questions
    if any(word in question_lower for word in ['policy', 'policies', 'rules', 'guidelines']):
        return "To view company policies:\n1. Go to Policies page\n2. Browse available policies\n3. Click on a policy to read details\n4. Download policy documents if available\n\nPolicies include company rules, leave policies, code of conduct, etc."
    
    # Reports questions
    if any(word in question_lower for word in ['report', 'reports', 'analytics', 'statistics']):
        if user_role in ['Admin', 'Manager', 'HR']:
            return "To view reports:\n1. Go to Reports page\n2. Select report type (tasks, attendance, etc.)\n3. Apply filters (date range, employee, etc.)\n4. View or download reports\n\nReports help you analyze team performance and attendance."
        else:
            return "Reports are available to Admin, Manager, and HR. Contact your manager for report access."
    
    # Default response
    return f"I understand you're asking about '{question}'. I can help you with:\n\n• User/Employee information (DOB, DOJ, phone, email, search, count)\n• Leave management (apply, balance, types)\n• Attendance (punch in/out, history, reports)\n• Tasks and projects\n• Payroll and payslips\n• Profile settings\n• Company policies\n• System features\n\nCould you rephrase your question or ask about one of these topics?"

@router.post("/chatbot/ask", response_model=ChatbotResponse)
def ask_chatbot(
    request: ChatbotRequest,
    http_request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Chatbot endpoint - answers questions based on user queries
    Available to all authenticated users (Employee, Manager, HR, Admin)
    """
    try:
        if not request.question or not request.question.strip():
            raise HTTPException(status_code=400, detail="Question cannot be empty")
        
        # Get chatbot response with database access for user queries
        answer = get_chatbot_response(
            request.question.strip(), 
            current_user.role,
            db=db,
            current_user=current_user
        )
        
        # Check if response contains selection data (format: "SELECTION:TYPE|||SEPARATOR|||JSON_DATA|||SEPARATOR|||TEXT")
        selection_required = False
        selection_data = None
        selection_type = None
        image_base64 = None
        
        if answer.startswith("SELECTION:"):
            # Split by the separator to get: SELECTION:TYPE, JSON_DATA, TEXT
            if "|||SEPARATOR|||" in answer:
                parts = answer.split("|||SEPARATOR|||")
                if len(parts) == 3:
                    # Extract type from first part (e.g., "SELECTION:USER")
                    type_part = parts[0].split(":")
                    if len(type_part) == 2:
                        selection_type = type_part[1]  # USER or LEAVE
                        try:
                            selection_data = json.loads(parts[1])
                            answer = parts[2]  # Only the text part (comma-separated names)
                            selection_required = True
                        except json.JSONDecodeError:
                            # If JSON parsing fails, treat as regular answer
                            answer = parts[2]
            else:
                # Fallback for old format (backward compatibility)
                parts = answer.split(":", 3)
                if len(parts) == 4:
                    selection_type = parts[1]
                    try:
                        selection_data = json.loads(parts[2])
                        answer = parts[3]
                        selection_required = True
                    except json.JSONDecodeError:
                        answer = parts[3]
        
        # Check if response contains image data (format: "IMAGE:name:empid:base64data")
        elif answer.startswith("IMAGE:"):
            parts = answer.split(":", 3)
            if len(parts) == 4:
                user_name = parts[1]
                user_empid = parts[2]
                image_data = parts[3]
                # Check if image_data is not null/empty
                if image_data and image_data.strip():
                    # If it's already a data URI, use it directly; otherwise it's just base64
                    if image_data.startswith("data:image/"):
                        image_base64 = image_data
                    else:
                        # Assume it's base64 and prepend data URI prefix
                        # Try to detect image type from base64 or default to jpeg
                        image_base64 = f"data:image/jpeg;base64,{image_data}"
                    answer = f"Profile image for {user_name} ({user_empid}):"
                else:
                    answer = f"Profile image is not uploaded for {user_name} ({user_empid})."
        
        return ChatbotResponse(
            answer=answer, 
            image_base64=image_base64,
            selection_required=selection_required,
            selection_data=selection_data,
            selection_type=selection_type
        )
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Chatbot error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error processing question: {str(e)}")
