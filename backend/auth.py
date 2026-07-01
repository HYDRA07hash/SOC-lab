import jwt
from datetime import datetime
from functools import wraps
from flask import request, jsonify, current_app
from models import User, InvalidatedToken
from database import db

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        # Check authorization header
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]
        
        if not token:
            return jsonify({'message': 'Access token is missing!'}), 401
        
        # Verify token is not in denylist
        try:
            denylisted = InvalidatedToken.query.filter_by(token=token).first()
            if denylisted:
                return jsonify({'message': 'Token has been invalidated (logged out)'}), 401
        except Exception:
            return jsonify({'message': 'Database connection error during authorization'}), 500
        
        try:
            # Decode token using JWT Secret
            data = jwt.decode(token, current_app.config['JWT_SECRET'], algorithms=['HS256'])
            
            # Re-verify user and roles from database on every request (prevents stale client claims)
            current_user = User.query.get(data['sub'])
            if not current_user:
                return jsonify({'message': 'User not found!'}), 401
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token has expired!'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Invalid token!'}), 401
            
        return f(current_user, *args, **kwargs)
    return decorated

def role_required(allowed_roles):
    def decorator(f):
        @wraps(f)
        def decorated_function(current_user, *args, **kwargs):
            # Re-query user to confirm role status directly from DB
            db_user = User.query.get(current_user.id)
            if not db_user or db_user.role not in allowed_roles:
                return jsonify({'message': f'Access denied! Requires one of the roles: {", ".join(allowed_roles)}'}), 403
            return f(db_user, *args, **kwargs)
        return decorated_function
    return decorator

def generate_token(user):
    payload = {
        'sub': user.id,
        'username': user.username,
        'role': user.role,
        'iat': datetime.utcnow(),
        'exp': datetime.utcnow() + current_app.config['JWT_EXPIRATION']
    }
    return jwt.encode(payload, current_app.config['JWT_SECRET'], algorithm='HS256')

def seed_default_users():
    # Check if we have users, if not, create default role accounts
    if User.query.first() is None:
        users_to_seed = [
            ('admin', 'admin@sentinelshield.local', 'admin123', 'Administrator'),
            ('analyst', 'analyst@sentinelshield.local', 'analyst123', 'SOC Analyst'),
            ('responder', 'responder@sentinelshield.local', 'responder123', 'Incident Responder'),
            ('engineer', 'engineer@sentinelshield.local', 'engineer123', 'Security Engineer')
        ]
        
        for username, email, pwd, role in users_to_seed:
            u = User(username=username, email=email, role=role)
            u.set_password(pwd)
            db.session.add(u)
        
        db.session.commit()
        print("Default security role users seeded successfully!")
