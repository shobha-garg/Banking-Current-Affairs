import os

class Config:
    SQLALCHEMY_DATABASE_URI = 'sqlite:///' + os.path.join(os.path.abspath(os.path.dirname(os.path.dirname(__file__))), 'quiz.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    SECRET_KEY = '84dbd219dbcca789bfeaa252c51a8d0526f184f96c9246f45ef96561abfb6110'  
    DEBUG = False