from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from database import get_db
from routes.auth import get_current_user
from models import User
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import re

router = APIRouter()

class ChatbotRequest(BaseModel):
    question: str

class ChatbotResponse(BaseModel):
    answer: str
    image_base64: Optional[str] = None  # For user profile images

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
                
                # Helper function to search user by name
                def find_user_by_name(name):
                    """Search for user by name"""
                    if not name or len(name.strip()) < 2:
                        return None
                    name_clean = name.strip()
                    # Try exact match first, then partial match
                    user = db.query(User).filter(
                        User.is_active == True,
                        User.name.ilike(f'%{name_clean}%')
                    ).first()
                    return user
                
                # UNIFIED FIELD QUERY HANDLER - Handles "what is [field] of [name]?" pattern
                # Check if question asks for a specific field OF a name (not empid)
                extracted_name = extract_name_from_question(question_lower)
                if extracted_name:
                    # Found a name in the question - search by name first
                    user = find_user_by_name(extracted_name)
                    
                    if user:
                        # Now determine which field is being asked for
                        if any(word in question_lower for word in ['empid', 'employee id', 'id']):
                            return f"Employee ID for {user.name}:\n\n• Employee ID: {user.empid}"
                        
                        elif any(word in question_lower for word in ['dob', 'date of birth', 'birthday', 'birth date']):
                            if user.dob:
                                dob_str = user.dob.strftime('%d-%m-%Y')
                                age = (datetime.now().date() - user.dob).days // 365
                                return f"Date of Birth for {user.name} ({user.empid}):\n\n• DOB: {dob_str}\n• Age: {age} years"
                            else:
                                return f"Date of Birth is not available for {user.name} ({user.empid})."
                        
                        elif any(word in question_lower for word in ['doj', 'date of joining', 'joining date', 'when joined']):
                            if user.doj:
                                doj_str = user.doj.strftime('%d-%m-%Y')
                                years_worked = (datetime.now().date() - user.doj).days // 365
                                return f"Date of Joining for {user.name} ({user.empid}):\n\n• DOJ: {doj_str}\n• Experience: {years_worked} years"
                            else:
                                return f"Date of Joining is not available for {user.name} ({user.empid})."
                        
                        elif any(word in question_lower for word in ['phone', 'mobile', 'contact number', 'phone number']):
                            if user.phone:
                                return f"Phone number for {user.name} ({user.empid}):\n\n• Phone: {user.phone}"
                            else:
                                return f"Phone number is not available for {user.name} ({user.empid})."
                        
                        elif any(word in question_lower for word in ['email', 'email address', 'mail id']):
                            return f"Email for {user.name} ({user.empid}):\n\n• Email: {user.email}"
                        
                        elif any(word in question_lower for word in ['designation']):
                            return f"Designation for {user.name} ({user.empid}):\n\n• Designation: {user.designation or 'N/A'}"
                        
                        elif any(word in question_lower for word in ['department']):
                            return f"Department for {user.name} ({user.empid}):\n\n• Department: {user.department_name or 'N/A'}"
                        
                        elif any(word in question_lower for word in ['branch']):
                            return f"Branch for {user.name} ({user.empid}):\n\n• Branch: {user.branch_name or 'N/A'}"
                        
                        elif any(word in question_lower for word in ['role']):
                            return f"Role for {user.name} ({user.empid}):\n\n• Role: {user.role or 'N/A'}"
                        
                        elif any(word in question_lower for word in ['name']):
                            return f"Name for Employee ID {user.empid}:\n\n• Name: {user.name}"
                        
                        elif any(word in question_lower for word in ['image', 'photo', 'picture', 'avatar', 'profile picture', 'profile image']):
                            # Return image response - will be handled separately in the endpoint
                            if user.image_base64 and user.image_base64.strip():
                                return f"IMAGE:{user.name}:{user.empid}:{user.image_base64}"
                            else:
                                return f"Profile image is not uploaded for {user.name} ({user.empid})."
                        
                        else:
                            # Name found but field not clear - return basic info
                            return f"Found user: {user.name} ({user.empid}). What information would you like? (empid, dob, doj, phone, email, designation, department, branch, role, image)"
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
                
                # DOJ (Date of Joining) queries
                elif any(word in question_lower for word in ['doj', 'date of joining', 'joining date', 'when joined']):
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
                            if user.doj:
                                doj_str = user.doj.strftime('%d-%m-%Y')
                                years_worked = (datetime.now().date() - user.doj).days // 365
                                return f"Date of Joining for {user.name} ({user.empid}):\n\n• DOJ: {doj_str}\n• Experience: {years_worked} years"
                            else:
                                return f"Date of Joining is not available for {user.name} ({user.empid})."
                        else:
                            return f"No user found with Employee ID: {empid}."
                    else:
                        return "To get DOJ, please specify the employee ID. For example: 'What is DOJ of empid 1027'"
                
                # Phone number queries
                elif any(word in question_lower for word in ['phone', 'mobile', 'contact number', 'phone number']):
                    empid_match = re.search(r'\b(\d{4,})\b', question_lower)
                    if empid_match:
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
                            if user.phone:
                                return f"Phone number for {user.name} ({user.empid}):\n\n• Phone: {user.phone}"
                            else:
                                return f"Phone number is not available for {user.name} ({user.empid})."
                        else:
                            return f"No user found with Employee ID: {empid}."
                    else:
                        return "To get phone number, please specify the employee ID."
                
                # Email queries
                elif any(word in question_lower for word in ['email', 'email address', 'mail id']):
                    empid_match = re.search(r'\b(\d{4,})\b', question_lower)
                    if empid_match:
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
                            return f"Email for {user.name} ({user.empid}):\n\n• Email: {user.email}"
                        else:
                            return f"No user found with Employee ID: {empid}."
                    else:
                        return "To get email, please specify the employee ID."
                
                # Image queries (empid-based)
                elif any(word in question_lower for word in ['image', 'photo', 'picture', 'avatar', 'profile picture', 'profile image']):
                    empid_match = re.search(r'\b(\d{4,})\b', question_lower)
                    if empid_match:
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
                            if user.image_base64 and user.image_base64.strip():
                                return f"IMAGE:{user.name}:{user.empid}:{user.image_base64}"
                            else:
                                return f"Profile image is not uploaded for {user.name} ({user.empid})."
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
    
    # PRIORITY 2: Leave related questions (only if not a user query)
    if any(word in question_lower for word in ['leave', 'holiday', 'vacation', 'time off']):
        if 'apply' in question_lower or 'how to apply' in question_lower:
            return "To apply for leave:\n1. Go to Employee → Apply Leave\n2. Select leave type (Sick, Casual, Annual, etc.)\n3. Choose start and end dates\n4. Add reason if required\n5. Submit your request\n\nYour manager/HR will review and approve it."
        elif 'balance' in question_lower or 'remaining' in question_lower:
            return "To check your leave balance:\n1. Go to Employee → Leaves List\n2. You'll see your available leave balance for each type\n\nFor detailed balance, HR can check Employee → Balance Leaves."
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
        
        # Check if response contains image data (format: "IMAGE:name:empid:base64data")
        image_base64 = None
        if answer.startswith("IMAGE:"):
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
        
        return ChatbotResponse(answer=answer, image_base64=image_base64)
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Chatbot error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error processing question: {str(e)}")
