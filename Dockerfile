FROM        git.freelock.com/freelock/php81
LABEL author=Freelock email=john@freelock.com

# Reset this, don't start a php process
CMD ['bash']

USER root
RUN export DEBIAN_FRONTEND=noninteractive && \
  apt-get update && apt-get -y install \
    curl \
    ca-certificates \
    libappindicator1 libasound2 libatk1.0-0 \
    libatk-bridge2.0-0 \
    libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 \
    libfontconfig1 libgcc1 libgconf-2-4 \
    libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 \
    libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 \
    libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 \
    libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 \
    libxrandr2 libxrender1 libxss1 libxtst6 \
    gconf-service lsb-release wget xdg-utils \
    fonts-liberation gnupg gnupg2 \
    openssh-client \
    jq \
    expect-dev \
    mysql-client \
    zip \
    rsync

RUN export DEBIAN_FRONTEND=noninteractive && \
    wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-unstable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf curl \
     ttf-mscorefonts-installer ttf-bitstream-vera fonts-dejavu \
      --no-install-recommends

RUN curl -sL https://deb.nodesource.com/setup_18.x | bash -

RUN export DEBIAN_FRONTEND=noninteractive && \
  apt-get install -y nodejs \
  jq unzip openssh-client
# Install composer
RUN bash -c "wget http://getcomposer.org/composer.phar && mv composer.phar /usr/local/bin/composer \
  && chmod 755 /usr/local/bin/composer"

# Install drush
RUN composer global require drush/drush:^11.0 symfony/http-kernel && mv ~/.config/composer /usr/local/composer && ln -s /usr/local/composer/vendor/bin/drush /usr/local/bin/drush

USER root
RUN mkdir -p /opt/visualify
WORKDIR /opt/visualify
ADD index.js visualify* package* /opt/visualify/
ADD lib/* /opt/visualify/lib/
ADD configs/* /opt/visualify/configs/
RUN npm install
RUN npm link
ADD hosts.txt /opt/visualify/
ENV COMPOSER_ALLOW_SUPERUSER=1
