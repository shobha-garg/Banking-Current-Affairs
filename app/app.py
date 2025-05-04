from flask import Flask, jsonify, request, render_template, send_from_directory
# from backend.models import db, All, January, February, March, GovtScheme, Budget , Economics
# from backend.config import Config
from backend import *
import random
import os
import json

app = Flask(__name__, static_folder='static', template_folder='templates')
app.config.from_object(Config)
db.init_app(app)

# Map category names to model classes and display names
CATEGORY_MODELS = {
    'all': All,
    'january': January,
    'february': February,
    'march': March,
    'april': April,
    'budget': Budget,
    'eco' : Economics,
    'govt_scheme': GovtScheme
}

CATEGORY_DISPLAY_NAMES = {
    'all': 'All Questions',
    'january': 'January',
    'february': 'February',
    'march': 'March',
    'april': 'April',
    'budget': 'Budget',
    'eco' : 'Economics',
    'govt_scheme': 'Government Schemes'
}

# Map file names to model classes
FILE_TO_MODEL = {
    'all.txt': All,
    'january.txt': January,
    'february.txt': February,
    'march.txt': March,
    'april.txt': April,
    'budget.txt': Budget,
    'eco.txt' : Economics,
    'govt_scheme.txt': GovtScheme
}

@app.route('/')
def index():
    """Serve the main frontend page"""
    categories = {key: CATEGORY_DISPLAY_NAMES[key] for key in CATEGORY_MODELS.keys()}
    return render_template('index.html', categories=categories)

@app.route('/static/<path:filename>')
def serve_static(filename):
    """Serve static files"""
    return send_from_directory('frontend/static', filename)

@app.route('/api/categories')
def get_categories():
    """Return all available categories"""
    categories = []
    for key, display_name in CATEGORY_DISPLAY_NAMES.items():
        count = CATEGORY_MODELS[key].query.count()
        categories.append({
            'id': key,
            'name': display_name,
            'count': count
        })
    return jsonify(categories)

@app.route('/api/questions/<category>')
def get_questions(category):
    """Get all questions from a category"""
    category = category.lower()
    if category not in CATEGORY_MODELS:
        return jsonify({'error': f'Invalid category. Available categories: {list(CATEGORY_MODELS.keys())}'}), 400
    
    model = CATEGORY_MODELS[category]
    questions = model.query.all()
    
    result = []
    for q in questions:
        result.append({
            'id': q.id,
            'question': q.question,
            'option_a': q.option_a,
            'option_b': q.option_b,
            'option_c': q.option_c,
            'option_d': q.option_d,
            'correct_option': q.correct_option,
            'flagged': q.flagged if hasattr(q, 'flagged') else False
        })
    
    return jsonify(result)

@app.route('/quiz/<category>', methods=['GET'])
def get_quiz(category):
    """Get random questions from specified category"""
    category = category.lower()
    if category not in CATEGORY_MODELS:
        return jsonify({'error': f'Invalid category. Available categories: {list(CATEGORY_MODELS.keys())}'}), 400
    
    # Get query parameter for number of questions (default 5)
    count = request.args.get('count', default=5, type=int)
    
    # Get random questions from the database
    model = CATEGORY_MODELS[category]
    questions = model.query.order_by(db.func.random()).limit(count).all()
    
    # Convert to dictionary format
    result = []
    for q in questions:
        result.append({
            'id': q.id,
            'question': q.question,
            'option_a': q.option_a,
            'option_b': q.option_b,
            'option_c': q.option_c,
            'option_d': q.option_d,
            'correct_option': q.correct_option,
            'flagged': q.flagged if hasattr(q, 'flagged') else False
        })
    
    return jsonify(result)

@app.route('/api/check-answer', methods=['POST'])
def check_answer():
    """Check if the provided answer is correct"""
    data = request.get_json()
    
    if not data or 'question_id' not in data or 'category' not in data or 'selected_option' not in data:
        return jsonify({'error': 'Missing required fields: question_id, category, selected_option'}), 400
    
    question_id = data['question_id']
    category = data['category'].lower()
    selected_option = data['selected_option'].upper()
    
    if category not in CATEGORY_MODELS:
        return jsonify({'error': f'Invalid category. Available categories: {list(CATEGORY_MODELS.keys())}'}), 400
    
    model = CATEGORY_MODELS[category]
    question = model.query.get(question_id)
    
    if not question:
        return jsonify({'error': 'Question not found'}), 404
    
    is_correct = question.correct_option.upper() == selected_option
    
    return jsonify({
        'is_correct': is_correct,
        'correct_option': question.correct_option if is_correct else None
    })

@app.route('/api/flag-question', methods=['POST'])
def flag_question():
    """Flag/unflag a question for review later"""
    data = request.get_json()
    
    if not data or 'question_id' not in data or 'category' not in data or 'flagged' not in data:
        return jsonify({'error': 'Missing required fields: question_id, category, flagged'}), 400
    
    question_id = data['question_id']
    category = data['category'].lower()
    flagged = data['flagged']
    
    if category not in CATEGORY_MODELS:
        return jsonify({'error': f'Invalid category. Available categories: {list(CATEGORY_MODELS.keys())}'}), 400
    
    model = CATEGORY_MODELS[category]
    question = model.query.get(question_id)
    
    if not question:
        return jsonify({'error': 'Question not found'}), 404
    
    try:
        question.flagged = flagged
        db.session.commit()
        return jsonify({'success': True, 'question_id': question_id, 'flagged': flagged})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update flagged status: {str(e)}'}), 500

@app.route('/api/flagged-questions/<category>', methods=['GET'])
def get_flagged_questions(category):
    """Get all flagged questions from a category"""
    category = category.lower()
    if category not in CATEGORY_MODELS:
        return jsonify({'error': f'Invalid category. Available categories: {list(CATEGORY_MODELS.keys())}'}), 400
    
    model = CATEGORY_MODELS[category]
    
    try:
        questions = model.query.filter_by(flagged=True).all()
        
        result = []
        for q in questions:
            result.append({
                'id': q.id,
                'question': q.question,
                'option_a': q.option_a,
                'option_b': q.option_b,
                'option_c': q.option_c,
                'option_d': q.option_d,
                'correct_option': q.correct_option,
                'flagged': True
            })
        
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': f'Failed to retrieve flagged questions: {str(e)}'}), 500

@app.route('/load_data', methods=['POST'])
def load_data():
    """Load data from text files into the database"""
    try:
        # Create tables if they don't exist
        db.create_all()
        
        # Get the directory of the current file (app.py)
        current_dir = os.path.dirname(os.path.abspath(__file__))
        # Construct the path to category-wise-questions inside the backend folder
        category_dir = os.path.join(current_dir, 'backend', 'category-wise-questions')
        
        if not os.path.exists(category_dir):
            return jsonify({"status": "error", "message": f"Directory not found: {category_dir}"}), 404
            
        results = {}
        
        # Process each file in the directory
        for filename in os.listdir(category_dir):
            if not filename.endswith('.txt'):
                results[filename] = "Skipped: Not a text file"
                continue
                
            file_path = os.path.join(category_dir, filename)
            
            # Determine which model to use based on filename
            if filename not in FILE_TO_MODEL:
                results[filename] = "Unknown file format"
                continue
                
            model = FILE_TO_MODEL[filename]
            
            # Clear existing data for this category
            try:
                model.query.delete()
                db.session.commit()
            except Exception as e:
                db.session.rollback()
                results[filename] = f"Failed to clear existing data: {str(e)}"
                continue
            
            # Read file content
            try:
                with open(file_path, 'r', encoding='utf-8') as file:
                    content = file.read().strip()
            except Exception as e:
                results[filename] = f"Failed to read file: {str(e)}"
                continue
            
            # Parse JSON content
            try:
                # Handle cases where content might be wrapped in a variable assignment (e.g., questions = [...])
                start = content.find('[')
                end = content.rfind(']')
                if start < 0 or end < start:
                    results[filename] = "No valid JSON array found in file"
                    continue
                    
                questions_json = content[start:end+1]
                questions = json.loads(questions_json)
                
                # Validate that questions is a list
                if not isinstance(questions, list):
                    results[filename] = "File content is not a JSON array"
                    continue
            except json.JSONDecodeError as e:
                results[filename] = f"JSON parsing error: {str(e)}"
                continue
            except Exception as e:
                results[filename] = f"Unexpected parsing error: {str(e)}"
                continue
            
            # Validate and insert questions into the database
            inserted_count = 0
            validation_errors = []
            try:
                for idx, q in enumerate(questions):
                    # Validate required fields
                    required_fields = ['question', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_option']
                    if not all(field in q for field in required_fields):
                        validation_errors.append(f"Question {idx + 1}: Missing required fields in {q}")
                        continue
                    
                    # Validate correct_option format (should be 'A', 'B', 'C', or 'D')
                    if q['correct_option'].upper() not in ['A', 'B', 'C', 'D']:
                        validation_errors.append(f"Question {idx + 1}: Invalid correct_option in question: {q['correct_option']}")
                        continue
                    
                    # Validate string lengths to avoid database errors
                    max_length = 500  # Adjust based on your schema
                    for field in ['question', 'option_a', 'option_b', 'option_c', 'option_d']:
                        if len(str(q[field])) > max_length:
                            validation_errors.append(f"Question {idx + 1}: Field {field} exceeds maximum length of {max_length} characters")
                            continue
                    
                    db_question = model(
                        question=str(q['question']),
                        option_a=str(q['option_a']),
                        option_b=str(q['option_b']),
                        option_c=str(q['option_c']),
                        option_d=str(q['option_d']),
                        correct_option=q['correct_option'].upper(),
                        flagged=False
                    )
                    db.session.add(db_question)
                    inserted_count += 1
                
                db.session.commit()
                if validation_errors:
                    results[filename] = f"Inserted {inserted_count} out of {len(questions)} questions. Errors: {validation_errors}"
                else:
                    results[filename] = f"Inserted {inserted_count} questions"
            except Exception as e:
                db.session.rollback()
                results[filename] = f"Database error after inserting {inserted_count} questions: {str(e)}"
                continue
        
        # Determine overall status
        if all("Inserted" in result for result in results.values()):
            return jsonify({"status": "success", "results": results})
        else:
            return jsonify({"status": "partial_success", "results": results}), 206
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": f"Unexpected error: {str(e)}"}), 500

@app.route('/stats', methods=['GET'])
def get_stats():
    """Get statistics about the number of questions per category"""
    stats = {}
    for category, model in CATEGORY_MODELS.items():
        total = model.query.count()
        flagged = 0
        try:
            flagged = model.query.filter_by(flagged=True).count()
        except:
            pass  # If flagged column doesn't exist yet
        
        stats[category] = {
            'total': total,
            'flagged': flagged
        }
    
    return jsonify(stats)

if __name__ == '__main__':
    with app.app_context():
        db.create_all()  # Create tables on startup
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)