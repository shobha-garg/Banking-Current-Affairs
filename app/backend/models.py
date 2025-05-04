from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class QuestionBase:
    id = db.Column(db.Integer, primary_key=True)
    question = db.Column(db.String(500), nullable=False)
    option_a = db.Column(db.String(500), nullable=False)
    option_b = db.Column(db.String(500), nullable=False)
    option_c = db.Column(db.String(500), nullable=False)
    option_d = db.Column(db.String(500), nullable=False)
    correct_option = db.Column(db.String(1), nullable=False)
    flagged = db.Column(db.Boolean, default=False, nullable=False) 

class All(db.Model, QuestionBase):
    __tablename__ = 'all_questions'

class January(db.Model, QuestionBase):
    __tablename__ = 'january_questions'

class February(db.Model, QuestionBase):
    __tablename__ = 'february_questions'
    
class March(db.Model, QuestionBase):
    __tablename__ = 'march_questions'

class GovtScheme(db.Model, QuestionBase):
    __tablename__ = 'govt_scheme_questions'

class Budget(db.Model, QuestionBase):
    __tablename__ = 'budget_questions'

class Economics(db.Model, QuestionBase):
    __tablename__ = 'eco_questions'