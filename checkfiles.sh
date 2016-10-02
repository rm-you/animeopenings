FILES=`awk '/file/ { print $2 }' videos.json | awk -F\" '{print $2}'`
DIR="video/"

if [ -n "$1" ]
then
    DIR="$1"
fi

for file in $FILES
do
    if [ ! -e "${DIR}${file}" ]
    then
        echo $file missing
    fi
done
