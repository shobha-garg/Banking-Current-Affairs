import os

class Config:
    SQLALCHEMY_DATABASE_URI = 'sqlite:///' + os.path.join(os.path.abspath(os.path.dirname(os.path.dirname(__file__))), 'quiz.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    SECRET_KEY = 'your_secret_key'  
    DEBUG = False