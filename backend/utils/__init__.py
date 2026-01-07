"""
Utils package for HRMS backend
This module re-exports functions from the parent utils.py file
to maintain backward compatibility while using the utils package structure.
"""
import sys
import os

# Import from parent utils.py file
# Get the parent directory (backend)
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

# Import all functions from utils.py (the file, not this package)
try:
    import importlib.util
    utils_file_path = os.path.join(parent_dir, 'utils.py')
    spec = importlib.util.spec_from_file_location("utils_module", utils_file_path)
    utils_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(utils_module)
    
    # Re-export all public functions and classes
    __all__ = [
        'hash_password',
        'verify_password',
        'create_access_token',
        'decode_token',
        'generate_meeting_link',
        'generate_empid',
        'is_admin_or_hr',
        'pwd_context',
        'get_ist_now',
        'get_ist_date',
        'IST'
    ]
    
    # Export functions
    hash_password = utils_module.hash_password
    verify_password = utils_module.verify_password
    create_access_token = utils_module.create_access_token
    decode_token = utils_module.decode_token
    generate_meeting_link = utils_module.generate_meeting_link
    generate_empid = utils_module.generate_empid
    is_admin_or_hr = utils_module.is_admin_or_hr
    pwd_context = utils_module.pwd_context
    get_ist_now = utils_module.get_ist_now
    get_ist_date = utils_module.get_ist_date
    IST = utils_module.IST
    
except Exception as e:
    # Fallback: try direct import (might work in some contexts)
    try:
        import utils as utils_module
        hash_password = utils_module.hash_password
        verify_password = utils_module.verify_password
        create_access_token = utils_module.create_access_token
        decode_token = utils_module.decode_token
        generate_meeting_link = utils_module.generate_meeting_link
        generate_empid = utils_module.generate_empid
        is_admin_or_hr = utils_module.is_admin_or_hr
        pwd_context = utils_module.pwd_context
        get_ist_now = utils_module.get_ist_now
        get_ist_date = utils_module.get_ist_date
        IST = utils_module.IST
    except ImportError:
        # If both methods fail, print error but don't crash
        print(f"Warning: Could not import from utils.py: {e}")
        # Define dummy functions to prevent import errors (not ideal but allows server to start)
        def verify_password(*args, **kwargs):
            raise NotImplementedError("utils.py import failed")
        def create_access_token(*args, **kwargs):
            raise NotImplementedError("utils.py import failed")
        def decode_token(*args, **kwargs):
            raise NotImplementedError("utils.py import failed")

