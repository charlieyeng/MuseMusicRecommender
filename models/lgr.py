import numpy as np
import pandas as pd
import sqlite3

from sklearn.linear_model import LogisticRegression

def main():
    users, songs, listening_histories = create_datasets()
        
    models = build_models(users, songs, listening_histories)
    recommend_songs_to_users(users, models, songs, out_file='./lgr-recommendations.txt')
    
def create_datasets():
    '''
        Create the datasets we will need to build our models.
    '''
    users = get_users_to_evaluate()
    songs = create_song_feature_space()
    listening_histories = get_user_listening_histories()
    
    return users, songs, listening_histories


def get_users_to_evaluate():
    triplets = pd.read_csv('../eval-data/year1_valid_triplets_visible.txt', 
                           names=('user_id', 'song_id', 'play_count'), 
                           delim_whitespace=True)
    
    return pd.Series(triplets['user_id'].unique(), name='user_id')


def create_song_feature_space():
    with sqlite3.connect('./data.db') as conn:
        songs = pd.read_sql_query('select * from songs;', conn)
    
    # remove the b' from the name of the features that are strings
    songs.loc[:, 'track_id':'artist_name'] = \
        songs.loc[:, 'track_id':'artist_name'] \
        .apply(lambda column: column.apply(lambda row: row.strip("b'")))
        
    return preprocess_songs(songs)


def preprocess_songs(songs):
    X = songs.drop(['track_id', 'title', 
            'danceability', 'energy'], axis='columns')

    year_median = int(X['year'][X['year'] != 0].mean())

    X['year'] = X['year'].apply(lambda year: year_median if year == 0 else year)
    X['artist_name'] = cat_to_num(X['artist_name'])
    X['release'] = cat_to_num(X['release'])
    
    return X

def cat_to_num(feature):
    categories = feature.unique()
    
    cat_to_num_map = dict()
    
    for i in range(len(categories)):
        if categories[i] not in cat_to_num_map:
            cat_to_num_map[categories[i]] = i
            
    return feature.apply(lambda row: cat_to_num_map[row])


def get_user_listening_histories():
    triplets = pd.read_csv('../eval-data/year1_valid_triplets_visible.txt', 
                       names=('user_id', 'song_id', 'play_count'), 
                       delim_whitespace=True)
    
    return groupby_to_dict(triplets.groupby('user_id')['song_id'])

def groupby_to_dict(groupby):
    dict_ = dict()
    
    for key, df in groupby:
        dict_[key] = df
    
    return dict_
    

def build_models(users, songs, listening_histories):
    '''
        Train and build models for each user.
    '''    
    models = []
    n = len(users)
    
    for i in range(len(users)):
        print('Building Model', i+1, '/', n)
        models.append(build_model(users[i], songs, listening_histories))
        
    return models


def build_model(user, songs, listening_histories):
    songs, y = create_label(songs, listening_histories[user])
    
    lgr = LogisticRegression()
    lgr.fit(songs, y)
    
    return lgr


def create_label(songs, user_listening_history):
    songs['y'] = np.zeros((songs.shape[0], 1), dtype=int)
    songs.loc[songs['song_id'].isin(user_listening_history), 'y'] = 1

    return songs.drop(['song_id', 'y'], axis='columns'), songs['y']
        

def recommend_songs_to_users(users, models, songs, out_file=None):
    '''
        Recommend songs to users based on built models.
    '''
    X = songs.drop(['song_id', 'y'], axis='columns')
    n = len(models)

    with open(out_file, 'w') as out:
        for i in range(len(models)):
            print('Recommendation', i+1, '/', n)
            scores = models[i].predict_proba(X)[:, 1]

            temp = pd.concat([songs['song_id'], pd.Series(scores, name='score')], axis='columns')
            temp = temp.sort_values('score', ascending=False)

            out.write(' '.join(temp['song_id'][:500]) + '\n')
        
    
if __name__ == '__main__':
    main()
